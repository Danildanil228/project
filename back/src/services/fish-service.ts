import type { PoolClient } from "pg";
import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import type { fishBulkCreateSchema, fishCreateSchema, fishUpdateSchema, referenceListQuerySchema } from "../lib/reference-schemas";

type ListQuery = z.infer<typeof referenceListQuerySchema>;
type FishCreate = z.infer<typeof fishCreateSchema>;
type FishUpdate = z.infer<typeof fishUpdateSchema>;
type FishBulkCreate = z.infer<typeof fishBulkCreateSchema>;

const updatableFields = ["name", "rarity", "photo", "trophyWeightGrams", "rareTrophyWeightGrams"] as const;
const fishColumns = {
    name: "name",
    rarity: "rarity",
    photo: "photo",
    trophyWeightGrams: "trophy_weight_grams",
    rareTrophyWeightGrams: "rare_trophy_weight_grams",
} as const;
const fishSelect = `
    f.id,
    f.name,
    f.rarity,
    f.photo,
    f.trophy_weight_grams AS "trophyWeightGrams",
    f.rare_trophy_weight_grams AS "rareTrophyWeightGrams",
    COALESCE((
        SELECT json_agg(json_build_object('id', w.id, 'name', w.name) ORDER BY w.name)
        FROM waterbody_fish wf
        JOIN waterbody w ON w.id = wf.waterbody_id
        WHERE wf.fish_id = f.id
    ), '[]'::json) AS waterbodies
`;

async function replaceWaterbodies(client: PoolClient, fishId: number, waterbodyIds: number[]) {
    await client.query(
        `DELETE FROM waterbody_fish WHERE fish_id = $1 AND NOT (waterbody_id = ANY($2::int[]))`,
        [fishId, waterbodyIds],
    );
    if (waterbodyIds.length) {
        await client.query(
            `INSERT INTO waterbody_fish (waterbody_id, fish_id)
             SELECT UNNEST($1::int[]), $2
             ON CONFLICT DO NOTHING`,
            [waterbodyIds, fishId],
        );
    }
    await client.query(
        `DELETE FROM spot_fish sf
         USING spot s
         WHERE sf.spot_id = s.id
           AND sf.fish_id = $1
           AND NOT (s.waterbody_id = ANY($2::int[]))`,
        [fishId, waterbodyIds],
    );
}

async function insertFish(client: PoolClient, data: FishCreate) {
    const { rows } = await client.query<{ id: number }>(
        `INSERT INTO fish (name, rarity, photo, trophy_weight_grams, rare_trophy_weight_grams)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [data.name, data.rarity, data.photo ?? null, data.trophyWeightGrams, data.rareTrophyWeightGrams],
    );
    const fishId = Number(rows[0].id);
    await replaceWaterbodies(client, fishId, data.waterbodyIds);
    return fishId;
}

async function createOrAttachFish(client: PoolClient, data: FishCreate) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(LOWER($1::text)))`, [data.name]);
    const existing = await client.query<{ id: number; name: string }>(
        `SELECT id, name FROM fish WHERE LOWER(name) = LOWER($1) LIMIT 1 FOR UPDATE`,
        [data.name],
    );
    if (!existing.rows[0]) {
        return { id: await insertFish(client, data), alreadyExisted: false, habitatsAdded: data.waterbodyIds.length };
    }

    let habitatsAdded = 0;
    if (data.waterbodyIds.length) {
        const added = await client.query(
            `INSERT INTO waterbody_fish (waterbody_id, fish_id)
             SELECT UNNEST($1::int[]), $2
             ON CONFLICT DO NOTHING
             RETURNING waterbody_id`,
            [data.waterbodyIds, existing.rows[0].id],
        );
        habitatsAdded = added.rowCount ?? 0;
    }
    return { id: Number(existing.rows[0].id), alreadyExisted: true, habitatsAdded };
}

export async function listFish(query: ListQuery) {
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.search) {
        values.push(`%${query.search}%`);
        where.push(`f.name ILIKE $${values.length}`);
    }
    if (query.rarity) {
        values.push(query.rarity);
        where.push(`f.rarity = $${values.length}`);
    }
    if (query.waterbodyId) {
        values.push(query.waterbodyId);
        where.push(`EXISTS (SELECT 1 FROM waterbody_fish wf WHERE wf.fish_id = f.id AND wf.waterbody_id = $${values.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM fish f ${whereSql}`, values);

    values.push(query.limit, query.offset);
    const { rows } = await pool.query(
        `SELECT ${fishSelect} FROM fish f ${whereSql} ORDER BY f.name ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return { items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function getFish(id: number) {
    const { rows } = await pool.query(`SELECT ${fishSelect} FROM fish f WHERE f.id = $1`, [id]);
    return rows[0] ?? null;
}

export async function createFish(data: FishCreate, actor: SessionUser) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await createOrAttachFish(client, data);
        await client.query("COMMIT");
        const item = await getFish(result.id);
        await writeAuditLog({
            actor,
            action: result.alreadyExisted ? "admin.fish.create_existing" : "admin.fish.create",
            metadata: { id: result.id, name: item?.name ?? data.name, waterbodyIds: data.waterbodyIds, habitatsAdded: result.habitatsAdded },
        });
        return { item, ...result };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function createFishBulk(data: FishBulkCreate, actor: SessionUser) {
    const client = await pool.connect();
    const results: Array<{ id: number; alreadyExisted: boolean; habitatsAdded: number }> = [];
    try {
        await client.query("BEGIN");
        for (const item of data.items) results.push(await createOrAttachFish(client, item));
        await client.query("COMMIT");
        const ids = results.map((result) => result.id);
        const result = await pool.query(`SELECT ${fishSelect} FROM fish f WHERE f.id = ANY($1::int[]) ORDER BY f.name`, [ids]);
        const created = results.filter((item) => !item.alreadyExisted).length;
        const existing = results.length - created;
        const habitatsAdded = results.reduce((total, item) => total + item.habitatsAdded, 0);
        await writeAuditLog({ actor, action: "admin.fish.bulk_create", metadata: { count: ids.length, created, existing, habitatsAdded, ids, names: data.items.map((item) => item.name) } });
        return { items: result.rows, created, existing, habitatsAdded };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function updateFish(id: number, data: FishUpdate, actor: SessionUser) {
    const client = await pool.connect();
    let previousPhoto: string | null = null;
    try {
        await client.query("BEGIN");
        const previous = await client.query<{ photo: string | null }>(`SELECT photo FROM fish WHERE id = $1 FOR UPDATE`, [id]);
        if (!previous.rows[0]) {
            await client.query("ROLLBACK");
            return null;
        }
        previousPhoto = previous.rows[0].photo;

        const fields: string[] = [];
        const values: unknown[] = [];
        for (const key of updatableFields) {
            if (key in data) {
                values.push((data as Record<string, unknown>)[key] ?? null);
                fields.push(`${fishColumns[key]} = $${values.length}`);
            }
        }
        if (fields.length) {
            values.push(id);
            await client.query(`UPDATE fish SET ${fields.join(", ")} WHERE id = $${values.length}`, values);
        }
        if (data.waterbodyIds) await replaceWaterbodies(client, id, data.waterbodyIds);
        await client.query("COMMIT");

        const item = await getFish(id);
        if ("photo" in data && previousPhoto && previousPhoto !== item?.photo) await deleteUploadedMedia(previousPhoto);
        await writeAuditLog({ actor, action: "admin.fish.update", metadata: { id, fields: Object.keys(data), waterbodyIds: data.waterbodyIds } });
        return item;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function deleteFish(id: number, actor: SessionUser) {
    const { rows } = await pool.query(`DELETE FROM fish WHERE id = $1 RETURNING id, name, photo`, [id]);
    if (!rows[0]) return null;

    await deleteUploadedMedia(rows[0].photo);
    await writeAuditLog({ actor, action: "admin.fish.delete", metadata: { id, name: rows[0].name } });
    return { id: rows[0].id, name: rows[0].name };
}
