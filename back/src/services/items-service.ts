import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import type { itemListQuerySchema } from "../lib/validation";

export type ItemType = "reels" | "rods";

type ItemListQuery = z.infer<typeof itemListQuerySchema>;

type ItemTypeConfig = {
    table: string;
    searchField: string;
    filterFields: string[];
    sortFields: Record<string, string>;
    defaultSort: string;
};

// Table/column names below are fixed (never user input), so they are safe to inline in SQL.
export const itemConfigs: Record<ItemType, ItemTypeConfig> = {
    reels: {
        table: "reels",
        searchField: "name",
        filterFields: ["category", "brend"],
        sortFields: { name: "name", lvl: "lvl", id: "id" },
        defaultSort: "name",
    },
    rods: {
        table: "rods",
        searchField: "name",
        filterFields: ["category", "brend", "type"],
        sortFields: { name: "name", lvl: "lvl", id: "id" },
        defaultSort: "name",
    },
};

export function isItemType(value: string): value is ItemType {
    return value === "reels" || value === "rods";
}

export function buildItemListQuery(type: ItemType, query: ItemListQuery) {
    const config = itemConfigs[type];
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.search) {
        values.push(`%${query.search}%`);
        where.push(`${config.searchField} ILIKE $${values.length}`);
    }

    for (const field of config.filterFields) {
        const value = query[field as keyof ItemListQuery];
        if (typeof value === "string" && value) {
            values.push(value);
            where.push(`${field} = $${values.length}`);
        }
    }

    if (query.minLvl !== undefined) {
        values.push(query.minLvl);
        where.push(`lvl >= $${values.length}`);
    }

    if (query.maxLvl !== undefined) {
        values.push(query.maxLvl);
        where.push(`lvl <= $${values.length}`);
    }

    const sortColumn = config.sortFields[query.sortBy] ?? config.defaultSort;
    const sortDirection = query.sortDirection === "desc" ? "DESC" : "ASC";

    return {
        whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
        orderSql: `${sortColumn} ${sortDirection}, id ASC`,
        values,
        limit: query.limit,
        offset: query.offset,
    };
}

export async function listItems(type: ItemType, query: ItemListQuery) {
    const config = itemConfigs[type];
    const { whereSql, orderSql, values, limit, offset } = buildItemListQuery(type, query);

    const countResult = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM ${config.table} ${whereSql}`,
        values,
    );

    values.push(limit, offset);
    const { rows } = await pool.query(
        `SELECT * FROM ${config.table} ${whereSql} ORDER BY ${orderSql} LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return {
        items: rows,
        total: countResult.rows[0]?.count ?? 0,
        limit,
        offset,
    };
}

export async function getItem(type: ItemType, id: number) {
    const config = itemConfigs[type];
    const { rows } = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

// Column names come from validated (Zod-stripped) data, so they are a safe known set.
export function buildInsertQuery(type: ItemType, data: Record<string, unknown>) {
    const config = itemConfigs[type];
    const keys = Object.keys(data);
    const columns = keys.map((key) => `"${key}"`).join(", ");
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");

    return {
        sql: `INSERT INTO ${config.table} (${columns}) VALUES (${placeholders}) RETURNING *`,
        values: keys.map((key) => data[key]),
    };
}

export function buildUpdateQuery(type: ItemType, id: number, data: Record<string, unknown>) {
    const config = itemConfigs[type];
    const keys = Object.keys(data);
    const setSql = keys.map((key, index) => `"${key}" = $${index + 1}`).join(", ");
    const values = keys.map((key) => data[key]);
    values.push(id);

    return {
        sql: `UPDATE ${config.table} SET ${setSql} WHERE id = $${values.length} RETURNING *`,
        values,
    };
}

export async function createItem(type: ItemType, data: Record<string, unknown>, actor: SessionUser) {
    const { sql, values } = buildInsertQuery(type, data);

    try {
        const { rows } = await pool.query(sql, values);
        await writeAuditLog({
            actor,
            action: `admin.${type}.create`,
            metadata: { id: rows[0].id, name: rows[0].name },
        });
        return rows[0];
    } catch (error) {
        translateDbError(error);
    }
}

export async function updateItem(type: ItemType, id: number, data: Record<string, unknown>, actor: SessionUser) {
    if (Object.keys(data).length === 0) {
        return getItem(type, id);
    }

    const touchesMedia = "photo" in data || "model" in data;
    const previous = touchesMedia ? await getItem(type, id) : null;
    const { sql, values } = buildUpdateQuery(type, id, data);

    try {
        const { rows } = await pool.query(sql, values);
        if (!rows[0]) return null;

        if (previous) {
            if ("photo" in data && previous.photo && previous.photo !== rows[0].photo) {
                await deleteUploadedMedia(previous.photo);
            }
            if ("model" in data && previous.model && previous.model !== rows[0].model) {
                await deleteUploadedMedia(previous.model);
            }
        }

        await writeAuditLog({
            actor,
            action: `admin.${type}.update`,
            metadata: { id, fields: Object.keys(data) },
        });
        return rows[0];
    } catch (error) {
        translateDbError(error);
    }
}

export async function deleteItem(type: ItemType, id: number, actor: SessionUser) {
    const config = itemConfigs[type];
    const { rows } = await pool.query(`DELETE FROM ${config.table} WHERE id = $1 RETURNING *`, [id]);
    if (!rows[0]) return null;

    await deleteUploadedMedia(rows[0].photo);
    await deleteUploadedMedia(rows[0].model);

    await writeAuditLog({
        actor,
        action: `admin.${type}.delete`,
        metadata: { id, name: rows[0].name },
    });
    return { id: rows[0].id, name: rows[0].name };
}
