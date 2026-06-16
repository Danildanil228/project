import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import type { fishCreateSchema, fishUpdateSchema, referenceListQuerySchema } from "../lib/reference-schemas";

type ListQuery = z.infer<typeof referenceListQuerySchema>;
type FishCreate = z.infer<typeof fishCreateSchema>;
type FishUpdate = z.infer<typeof fishUpdateSchema>;

const updatableFields = ["name", "rarity", "photo"] as const;

export async function listFish(query: ListQuery) {
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.search) {
        values.push(`%${query.search}%`);
        where.push(`name ILIKE $${values.length}`);
    }
    if (query.rarity) {
        values.push(query.rarity);
        where.push(`rarity = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM fish ${whereSql}`, values);

    values.push(query.limit, query.offset);
    const { rows } = await pool.query(
        `SELECT id, name, rarity, photo FROM fish ${whereSql} ORDER BY name ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return { items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function getFish(id: number) {
    const { rows } = await pool.query(`SELECT id, name, rarity, photo FROM fish WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function createFish(data: FishCreate, actor: SessionUser) {
    try {
        const { rows } = await pool.query(
            `INSERT INTO fish (name, rarity, photo) VALUES ($1, $2, $3) RETURNING *`,
            [data.name, data.rarity, data.photo ?? null],
        );
        await writeAuditLog({ actor, action: "admin.fish.create", metadata: { id: rows[0].id, name: rows[0].name } });
        return rows[0];
    } catch (error) {
        translateDbError(error);
    }
}

export async function updateFish(id: number, data: FishUpdate, actor: SessionUser) {
    const fields: string[] = [];
    const values: unknown[] = [];
    const previous = "photo" in data ? await getFish(id) : null;

    for (const key of updatableFields) {
        if (key in data) {
            values.push((data as Record<string, unknown>)[key] ?? null);
            fields.push(`${key} = $${values.length}`);
        }
    }

    if (fields.length === 0) return getFish(id);

    values.push(id);
    try {
        const { rows } = await pool.query(`UPDATE fish SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
        if (!rows[0]) return null;

        if (previous && previous.photo && previous.photo !== rows[0].photo) {
            await deleteUploadedMedia(previous.photo);
        }
        await writeAuditLog({ actor, action: "admin.fish.update", metadata: { id, fields: Object.keys(data) } });
        return rows[0];
    } catch (error) {
        translateDbError(error);
    }
}

export async function deleteFish(id: number, actor: SessionUser) {
    const { rows } = await pool.query(`DELETE FROM fish WHERE id = $1 RETURNING id, name, photo`, [id]);
    if (!rows[0]) return null;

    await deleteUploadedMedia(rows[0].photo);
    await writeAuditLog({ actor, action: "admin.fish.delete", metadata: { id, name: rows[0].name } });
    return { id: rows[0].id, name: rows[0].name };
}
