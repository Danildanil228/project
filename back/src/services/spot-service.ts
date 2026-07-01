import type { z } from "zod";
import type { SessionUser } from "../lib/admin-auth";
import { writeAuditLog } from "../lib/audit-log";
import { pool } from "../lib/db";
import { translateDbError } from "../lib/db-errors";
import { invalidWaterbodyFishIds, type spotCreateSchema, type spotUpdateSchema, type spotVariantsCreateSchema } from "../lib/spot-schemas";
import { postMapLinkingEnabled } from "../lib/features";

type SpotCreate = z.infer<typeof spotCreateSchema>;
type SpotUpdate = z.infer<typeof spotUpdateSchema>;
type SpotVariantsCreate = z.infer<typeof spotVariantsCreateSchema>;

const selectFields = `
    s.id::int AS id,
    s.waterbody_id AS "waterbodyId",
    s.name,
    s.description,
    s.map_x::float AS "mapX",
    s.map_y::float AS "mapY",
    s.game_coordinate_x::float AS "gameCoordinateX",
    s.game_coordinate_y::float AS "gameCoordinateY",
    s.geometry_type AS "geometryType",
    s.trolling_area AS "trollingArea",
    s.is_active AS "isActive",
    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"
`;

async function attachRelations<T extends { id: number }>(spots: T[]) {
    if (!spots.length) return [];
    const ids = spots.map((spot) => spot.id);
    const variants = await pool.query(
        `SELECT sv.id::int AS id, sv.spot_id AS "spotId",
                sv.fishing_method AS "fishingMethod", sv.description,
                sv.depth::float AS depth, sv.clip_distance AS "clipDistance",
                sv.order_index AS "orderIndex"
         FROM spot_variant sv
         WHERE sv.spot_id = ANY($1::bigint[])
         ORDER BY sv.spot_id, sv.order_index, sv.id`,
        [ids],
    );
    const variantIds = variants.rows.map((variant) => Number(variant.id));
    const [fish, baits, posts] = await Promise.all([
        variantIds.length ? pool.query(
            `SELECT svf.variant_id AS "variantId", f.id, f.name, f.rarity, f.photo
             FROM spot_variant_fish svf JOIN fish f ON f.id = svf.fish_id
             WHERE svf.variant_id = ANY($1::bigint[]) ORDER BY f.name`,
            [variantIds],
        ) : Promise.resolve({ rows: [] }),
        variantIds.length ? pool.query(
            `SELECT svb.variant_id AS "variantId", b.id, b.name, b.kind, b.photo, b.domain,
                    b.category_code AS "categoryCode", bc.name_ru AS "categoryName"
             FROM spot_variant_bait svb
             JOIN bait b ON b.id = svb.bait_id
             LEFT JOIN bait_category bc ON bc.code = b.category_code
             WHERE svb.variant_id = ANY($1::bigint[]) ORDER BY b.name`,
            [variantIds],
        ) : Promise.resolve({ rows: [] }),
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

    const fishByVariant = new Map<number, Record<string, unknown>[]>();
    const baitsByVariant = new Map<number, Record<string, unknown>[]>();
    const variantsBySpot = new Map<number, Record<string, unknown>[]>();
    const postsBySpot = new Map<number, Record<string, unknown>[]>();
    for (const { variantId, ...item } of fish.rows) {
        const key = Number(variantId);
        fishByVariant.set(key, [...(fishByVariant.get(key) ?? []), item]);
    }
    for (const { variantId, ...item } of baits.rows) {
        const key = Number(variantId);
        baitsByVariant.set(key, [...(baitsByVariant.get(key) ?? []), item]);
    }
    for (const { spotId, ...variant } of variants.rows) {
        const key = Number(spotId);
        const variantId = Number(variant.id);
        variantsBySpot.set(key, [...(variantsBySpot.get(key) ?? []), {
            ...variant,
            fish: fishByVariant.get(variantId) ?? [],
            baits: baitsByVariant.get(variantId) ?? [],
        }]);
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
        variants: variantsBySpot.get(Number(spot.id)) ?? [],
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

async function insertVariants(client: import("pg").PoolClient, spotId: number, variants: SpotCreate["variants"], startIndex = 0) {
    for (const [index, variant] of variants.entries()) {
        const result = await client.query<{ id: string }>(
            `INSERT INTO spot_variant (
                spot_id, fishing_method, description, depth, clip_distance, order_index
             ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [spotId, variant.fishingMethod, variant.description, variant.depth, variant.clipDistance, startIndex + index],
        );
        const variantId = Number(result.rows[0].id);
        if (variant.fishIds.length) {
            await client.query(
                `INSERT INTO spot_variant_fish (variant_id, fish_id) SELECT $1, UNNEST($2::int[])`,
                [variantId, variant.fishIds],
            );
        }
        if (variant.baitIds.length) {
            await client.query(
                `INSERT INTO spot_variant_bait (variant_id, bait_id) SELECT $1, UNNEST($2::int[])`,
                [variantId, variant.baitIds],
            );
        }
    }
}

function assertVariantGeometry(geometryType: "point" | "trolling", variants: SpotCreate["variants"]) {
    const invalid = geometryType === "trolling"
        ? variants.some((variant) => variant.fishingMethod !== "Троллинг")
        : variants.some((variant) => variant.fishingMethod === "Троллинг");
    if (invalid) {
        throw Object.assign(new Error(geometryType === "trolling"
            ? "В троллинговую зону можно добавить только троллинговый способ ловли"
            : "Троллинг нужно добавлять в отдельную зону"), { statusCode: 400 });
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
        const fishIds = [...new Set(data.variants.flatMap((variant) => variant.fishIds))];
        await assertWaterbodyFish(client, data.waterbodyId, fishIds);
        const { rows } = await client.query(
            `INSERT INTO spot (
                waterbody_id, name, description, map_x, map_y, game_coordinate_x,
                game_coordinate_y, geometry_type, trolling_area, is_active, created_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) RETURNING id`,
            [data.waterbodyId, data.name, data.description, data.mapX, data.mapY, data.gameCoordinateX, data.gameCoordinateY, data.geometryType, data.trollingArea ? JSON.stringify(data.trollingArea) : null, data.isActive, actor.id],
        );
        const spotId = Number(rows[0].id);
        await insertVariants(client, spotId, data.variants);
        await client.query("COMMIT");
        await writeAuditLog({ actor, action: "admin.spot.create", metadata: { id: spotId, waterbodyId: data.waterbodyId, name: data.name, geometryType: data.geometryType, variantCount: data.variants.length } });
        return getSpot(spotId);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function updateSpot(id: number, data: SpotUpdate, actor: SessionUser) {
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
        const fishIds = [...new Set(data.variants.flatMap((variant) => variant.fishIds))];
        await assertWaterbodyFish(client, Number(existing.rows[0].waterbodyId), fishIds);
        await client.query(
            `UPDATE spot SET name=$1, description=$2, map_x=$3, map_y=$4,
                    game_coordinate_x=$5, game_coordinate_y=$6, geometry_type=$7,
                    trolling_area=$8::jsonb, is_active=$9, depth=NULL, clip_distance=NULL,
                    updated_at=NOW()
             WHERE id=$10`,
            [data.name, data.description, data.mapX, data.mapY, data.gameCoordinateX, data.gameCoordinateY, data.geometryType, data.trollingArea ? JSON.stringify(data.trollingArea) : null, data.isActive, id],
        );
        await client.query(`DELETE FROM spot_fish WHERE spot_id=$1`, [id]);
        await client.query(`DELETE FROM spot_bait WHERE spot_id=$1`, [id]);
        await client.query(`DELETE FROM spot_variant WHERE spot_id=$1`, [id]);
        await insertVariants(client, id, data.variants);
        await client.query("COMMIT");
        const spot = await getSpot(id);
        await writeAuditLog({ actor, action: "admin.spot.update", metadata: { id, name: spot?.name, geometryType: data.geometryType, variantCount: data.variants.length } });
        return spot;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function addSpotVariants(id: number, data: SpotVariantsCreate, actor: SessionUser) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const existing = await client.query<{ waterbodyId: number; geometryType: "point" | "trolling" }>(
            `SELECT waterbody_id AS "waterbodyId", geometry_type AS "geometryType" FROM spot WHERE id=$1 FOR UPDATE`,
            [id],
        );
        if (!existing.rows[0]) {
            await client.query("ROLLBACK");
            return null;
        }
        assertVariantGeometry(existing.rows[0].geometryType, data.variants);
        const fishIds = [...new Set(data.variants.flatMap((variant) => variant.fishIds))];
        await assertWaterbodyFish(client, Number(existing.rows[0].waterbodyId), fishIds);
        const order = await client.query<{ nextIndex: number }>(
            `SELECT COALESCE(MAX(order_index) + 1, 0)::int AS "nextIndex" FROM spot_variant WHERE spot_id=$1`,
            [id],
        );
        await insertVariants(client, id, data.variants, order.rows[0].nextIndex);
        await client.query(`UPDATE spot SET updated_at=NOW() WHERE id=$1`, [id]);
        await client.query("COMMIT");
        const spot = await getSpot(id);
        await writeAuditLog({ actor, action: "admin.spot.update", metadata: { id, name: spot?.name, addedMethods: data.variants.map((variant) => variant.fishingMethod) } });
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
