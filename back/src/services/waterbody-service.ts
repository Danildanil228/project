import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import type { referenceListQuerySchema, waterbodyCreateSchema, waterbodyUpdateSchema } from "../lib/reference-schemas";

type ListQuery = z.infer<typeof referenceListQuerySchema>;
type WaterbodyCreate = z.infer<typeof waterbodyCreateSchema>;
type WaterbodyUpdate = z.infer<typeof waterbodyUpdateSchema>;

export async function listWaterbodies(query: ListQuery) {
    const values: unknown[] = [];
    let whereSql = "";

    if (query.search) {
        values.push(`%${query.search}%`);
        whereSql = `WHERE w.name ILIKE $${values.length}`;
    }

    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM waterbody w ${whereSql}`, values);

    values.push(query.limit, query.offset);
    const { rows } = await pool.query(
        `
            SELECT w.id, w.name, w.photo, COUNT(wf.fish_id)::int AS "fishCount"
            FROM waterbody w
            LEFT JOIN waterbody_fish wf ON wf.waterbody_id = w.id
            ${whereSql}
            GROUP BY w.id
            ORDER BY w.name ASC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return { items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function getWaterbody(id: number) {
    const { rows } = await pool.query(`SELECT id, name, photo FROM waterbody WHERE id = $1`, [id]);
    if (!rows[0]) return null;

    const fish = await pool.query(
        `
            SELECT f.id, f.name, f.rarity
            FROM waterbody_fish wf
            JOIN fish f ON f.id = wf.fish_id
            WHERE wf.waterbody_id = $1
            ORDER BY f.name ASC
        `,
        [id],
    );

    return { ...rows[0], fish: fish.rows };
}

export async function createWaterbody(data: WaterbodyCreate, actor: SessionUser) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(`INSERT INTO waterbody (name, photo) VALUES ($1, $2) RETURNING id, name`, [data.name, data.photo ?? null]);
        const waterbodyId = rows[0].id;

        if (data.fishIds.length) {
            await client.query(`INSERT INTO waterbody_fish (waterbody_id, fish_id) SELECT $1, UNNEST($2::int[])`, [waterbodyId, data.fishIds]);
        }

        await client.query("COMMIT");
        await writeAuditLog({ actor, action: "admin.waterbody.create", metadata: { id: waterbodyId, name: rows[0].name, fishCount: data.fishIds.length } });
        return getWaterbody(waterbodyId);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function updateWaterbody(id: number, data: WaterbodyUpdate, actor: SessionUser) {
    const previous = "photo" in data ? await getWaterbody(id) : null;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const fields: string[] = [];
        const values: unknown[] = [];
        for (const key of ["name", "photo"] as const) {
            if (key in data) {
                values.push((data as Record<string, unknown>)[key] ?? null);
                fields.push(`${key} = $${values.length}`);
            }
        }

        let exists = true;
        if (fields.length) {
            values.push(id);
            const updated = await client.query(`UPDATE waterbody SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING id`, values);
            exists = (updated.rowCount ?? 0) > 0;
        } else {
            const check = await client.query(`SELECT id FROM waterbody WHERE id = $1`, [id]);
            exists = (check.rowCount ?? 0) > 0;
        }

        if (!exists) {
            await client.query("ROLLBACK");
            return null;
        }

        if ("fishIds" in data && data.fishIds) {
            await client.query(`DELETE FROM waterbody_fish WHERE waterbody_id = $1`, [id]);
            if (data.fishIds.length) {
                await client.query(`INSERT INTO waterbody_fish (waterbody_id, fish_id) SELECT $1, UNNEST($2::int[])`, [id, data.fishIds]);
            }
        }

        await client.query("COMMIT");

        if (previous && previous.photo && "photo" in data && previous.photo !== (data.photo ?? null)) {
            await deleteUploadedMedia(previous.photo);
        }
        await writeAuditLog({ actor, action: "admin.waterbody.update", metadata: { id, fields: Object.keys(data) } });
        return getWaterbody(id);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

export async function deleteWaterbody(id: number, actor: SessionUser) {
    const { rows } = await pool.query(`DELETE FROM waterbody WHERE id = $1 RETURNING id, name, photo`, [id]);
    if (!rows[0]) return null;

    await deleteUploadedMedia(rows[0].photo);
    await writeAuditLog({ actor, action: "admin.waterbody.delete", metadata: { id, name: rows[0].name } });
    return { id: rows[0].id, name: rows[0].name };
}
