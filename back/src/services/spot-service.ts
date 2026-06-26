import type { z } from "zod";
import type { SessionUser } from "../lib/admin-auth";
import { writeAuditLog } from "../lib/audit-log";
import { pool } from "../lib/db";
import { translateDbError } from "../lib/db-errors";
import { invalidWaterbodyFishIds, type spotCreateSchema, type spotUpdateSchema } from "../lib/spot-schemas";
import { postMapLinkingEnabled } from "../lib/features";

type SpotCreate = z.infer<typeof spotCreateSchema>;
type SpotUpdate = z.infer<typeof spotUpdateSchema>;

const selectFields = `
    s.id::int AS id,
    s.waterbody_id AS "waterbodyId",
    s.name,
    s.description,
    s.map_x::float AS "mapX",
    s.map_y::float AS "mapY",
    s.game_coordinate_x::float AS "gameCoordinateX",
    s.game_coordinate_y::float AS "gameCoordinateY",
    s.depth::float AS depth,
    s.clip_distance AS "clipDistance",
    s.is_active AS "isActive",
    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"
`;

async function attachRelations<T extends { id: number }>(spots: T[]) {
    if (!spots.length) return [];
    const ids = spots.map((spot) => spot.id);
    const [fish, baits, posts] = await Promise.all([
        pool.query(
            `SELECT sf.spot_id AS "spotId", f.id, f.name, f.rarity, f.photo
             FROM spot_fish sf JOIN fish f ON f.id = sf.fish_id
             WHERE sf.spot_id = ANY($1::bigint[]) ORDER BY f.name`,
            [ids],
        ),
        pool.query(
            `SELECT sb.spot_id AS "spotId", b.id, b.name, b.kind, b.photo, b.domain,
                    b.category_code AS "categoryCode", bc.name_ru AS "categoryName"
             FROM spot_bait sb
             JOIN bait b ON b.id = sb.bait_id
             LEFT JOIN bait_category bc ON bc.code = b.category_code
             WHERE sb.spot_id = ANY($1::bigint[]) ORDER BY b.name`,
            [ids],
        ),
        postMapLinkingEnabled ? pool.query(
            `SELECT sp.spot_id AS "spotId", p.id::int AS "postId", p.published_at AS "publishedAt",
                    u.name AS "authorName", ms.id::int AS "submissionId"
             FROM spot_post sp
             JOIN post p ON p.id=sp.post_id AND p.status='approved'
             JOIN "user" u ON u.id=p.author_id
             JOIN map_submission ms ON ms.id=sp.submission_id AND ms.status='approved'
             WHERE sp.spot_id=ANY($1::bigint[])
             ORDER BY p.published_at DESC`,
            [ids],
        ) : Promise.resolve({ rows: [] }),
    ]);

    const submissionIds = posts.rows.map((post) => Number(post.submissionId));
    const targets = submissionIds.length ? await pool.query(
        `SELECT mst.submission_id AS "submissionId", f.id AS "fishId", f.name AS "fishName",
                COALESCE(json_agg(json_build_object(
                    'id',b.id,'name',b.name,'kind',b.kind,'photo',b.photo,'domain',b.domain,
                    'categoryCode',b.category_code,'categoryName',bc.name_ru
                ) ORDER BY b.name) FILTER (WHERE b.id IS NOT NULL),'[]'::json) AS baits
         FROM map_submission_target mst
         JOIN fish f ON f.id=mst.fish_id
         LEFT JOIN map_submission_target_bait mstb ON mstb.target_id=mst.id
         LEFT JOIN bait b ON b.id=mstb.bait_id
         LEFT JOIN bait_category bc ON bc.code=b.category_code
         WHERE mst.submission_id=ANY($1::bigint[])
         GROUP BY mst.submission_id,f.id,f.name ORDER BY f.name`,
        [submissionIds],
    ) : { rows: [] };

    const fishBySpot = new Map<number, Record<string, unknown>[]>();
    const baitsBySpot = new Map<number, Record<string, unknown>[]>();
    const postsBySpot = new Map<number, Record<string, unknown>[]>();
    for (const { spotId, ...item } of fish.rows) {
        const key = Number(spotId);
        fishBySpot.set(key, [...(fishBySpot.get(key) ?? []), item]);
    }
    for (const { spotId, ...item } of baits.rows) {
        const key = Number(spotId);
        baitsBySpot.set(key, [...(baitsBySpot.get(key) ?? []), item]);
    }
    for (const { spotId, submissionId, ...item } of posts.rows) {
        const key = Number(spotId);
        postsBySpot.set(key, [...(postsBySpot.get(key) ?? []), {
            ...item,
            targets: targets.rows
                .filter((target) => Number(target.submissionId) === Number(submissionId))
                .map(({ submissionId: _submissionId, ...target }) => target),
        }]);
    }

    return spots.map((spot) => ({
        ...spot,
        fish: fishBySpot.get(Number(spot.id)) ?? [],
        baits: baitsBySpot.get(Number(spot.id)) ?? [],
        posts: postsBySpot.get(Number(spot.id)) ?? [],
    }));
}

export async function listSpots(waterbodyId: number, includeInactive = false) {
    const { rows } = await pool.query(
        `SELECT ${selectFields} FROM spot s
         WHERE s.waterbody_id = $1 ${includeInactive ? "" : "AND s.is_active = TRUE"}
         ORDER BY s.name ASC`,
        [waterbodyId],
    );
    return attachRelations(rows);
}

export async function getSpot(id: number) {
    const { rows } = await pool.query(`SELECT ${selectFields} FROM spot s WHERE s.id = $1`, [id]);
    if (!rows[0]) return null;
    return (await attachRelations(rows))[0];
}

async function replaceRelations(client: import("pg").PoolClient, spotId: number, table: "spot_fish" | "spot_bait", column: "fish_id" | "bait_id", ids: number[]) {
    await client.query(`DELETE FROM ${table} WHERE spot_id = $1`, [spotId]);
    if (ids.length) {
        await client.query(`INSERT INTO ${table} (spot_id, ${column}) SELECT $1, UNNEST($2::int[])`, [spotId, ids]);
    }
}

async function assertWaterbodyFish(client: import("pg").PoolClient, waterbodyId: number, fishIds: number[]) {
    if (!fishIds.length) return;
    const { rows } = await client.query<{ fishId: number }>(
        `SELECT fish_id AS "fishId" FROM waterbody_fish WHERE waterbody_id = $1 AND fish_id = ANY($2::int[])`,
        [waterbodyId, fishIds],
    );
    if (invalidWaterbodyFishIds(fishIds, rows.map((row) => Number(row.fishId))).length) {
        throw Object.assign(new Error("Для точки можно выбрать только рыб, обитающих в этом водоёме"), { statusCode: 400 });
    }
}

export async function createSpot(data: SpotCreate, actor: SessionUser) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            `INSERT INTO spot (
                waterbody_id, name, description, map_x, map_y, game_coordinate_x,
                game_coordinate_y, depth, clip_distance, is_active, created_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [data.waterbodyId, data.name, data.description, data.mapX, data.mapY, data.gameCoordinateX, data.gameCoordinateY, data.depth, data.clipDistance, data.isActive, actor.id],
        );
        const spotId = Number(rows[0].id);
        await assertWaterbodyFish(client, data.waterbodyId, data.fishIds);
        await replaceRelations(client, spotId, "spot_fish", "fish_id", data.fishIds);
        await replaceRelations(client, spotId, "spot_bait", "bait_id", data.baitIds);
        await client.query("COMMIT");
        await writeAuditLog({ actor, action: "admin.spot.create", metadata: { id: spotId, waterbodyId: data.waterbodyId, name: data.name } });
        return getSpot(spotId);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function updateSpot(id: number, data: SpotUpdate, actor: SessionUser) {
    const columns = {
        name: "name",
        description: "description",
        mapX: "map_x",
        mapY: "map_y",
        gameCoordinateX: "game_coordinate_x",
        gameCoordinateY: "game_coordinate_y",
        depth: "depth",
        clipDistance: "clip_distance",
        isActive: "is_active",
    } as const;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const existing = await client.query<{ waterbodyId: number }>(
            `SELECT waterbody_id AS "waterbodyId" FROM spot WHERE id = $1 FOR UPDATE`,
            [id],
        );
        if (!existing.rows[0]) {
            await client.query("ROLLBACK");
            return null;
        }
        const fields: string[] = [];
        const values: unknown[] = [];
        for (const [key, column] of Object.entries(columns)) {
            if (key in data) {
                values.push((data as Record<string, unknown>)[key] ?? null);
                fields.push(`${column} = $${values.length}`);
            }
        }

        if (fields.length) {
            values.push(id);
            const updated = await client.query(`UPDATE spot SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING id`, values);
            if (!updated.rowCount) {
                await client.query("ROLLBACK");
                return null;
            }
        }

        if (data.fishIds) {
            await assertWaterbodyFish(client, Number(existing.rows[0].waterbodyId), data.fishIds);
            await replaceRelations(client, id, "spot_fish", "fish_id", data.fishIds);
        }
        if (data.baitIds) await replaceRelations(client, id, "spot_bait", "bait_id", data.baitIds);
        await client.query("COMMIT");
        const spot = await getSpot(id);
        await writeAuditLog({ actor, action: "admin.spot.update", metadata: { id, name: spot?.name, fields: Object.keys(data) } });
        return spot;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function deleteSpot(id: number, actor: SessionUser) {
    const { rows } = await pool.query(`DELETE FROM spot WHERE id = $1 RETURNING id::int AS id, name, waterbody_id AS "waterbodyId"`, [id]);
    if (!rows[0]) return null;
    await writeAuditLog({ actor, action: "admin.spot.delete", metadata: rows[0] });
    return rows[0];
}
