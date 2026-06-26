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
    searchFields: string[];
    filterFields: string[];
    sortFields: Record<string, string>;
    defaultSort: string;
};

// Columns stored as VARCHAR but semantically numeric (e.g. per="5.2:1", price_ser="1500", test="0-50 гр").
// Sorting them as text gives "10" < "2"; we extract the first number with regex and cast to numeric in ORDER BY.
// `size` and `lvl` are already INT — they sort natively.
const numericSortColumns: Record<ItemType, Set<string>> = {
    reels: new Set(["test", "per", "per_mod", "speed", "speed_mod", "frik", "frik_mod", "meh", "meh_mod", "price_ser", "price_gold", "capacity", "capacity_mod"]),
    // `power` looks numeric but RF4 stores symbolic classes ("UL", "L", "ML", "M", "MH", "H", "XH", and freeform "Среднее"/"Лёгкое") — keep it as text sort.
    rods: new Set(["test_down", "test_up", "length", "sensi", "rig", "stren", "bonus_opit", "bonus_nav", "bonus_zabros", "price_ser", "price_gold"]),
};

// Table/column names below are fixed (never user input), so they are safe to inline in SQL.
export const itemConfigs: Record<ItemType, ItemTypeConfig> = {
    reels: {
        table: "reels",
        searchFields: ["name", "category", "brend", "size", "test", "test_mod", "protection", "per", "per_mod", "speed", "speed_mod", "frik", "frik_mod", "meh", "meh_mod", "lvl", "price_ser", "price_gold", "capacity", "capacity_mod"],
        filterFields: ["name", "category", "brend", "size", "test", "test_mod", "protection", "per", "per_mod", "speed", "speed_mod", "frik", "frik_mod", "meh", "meh_mod", "lvl", "price_ser", "price_gold", "capacity", "capacity_mod"],
        sortFields: { name: "name", category: "category", brend: "brend", size: "size", test: "test", test_mod: "test_mod", protection: "protection", per: "per", per_mod: "per_mod", speed: "speed", speed_mod: "speed_mod", frik: "frik", frik_mod: "frik_mod", meh: "meh", meh_mod: "meh_mod", lvl: "lvl", price_ser: "price_ser", price_gold: "price_gold", capacity: "capacity", capacity_mod: "capacity_mod", id: "id" },
        defaultSort: "name",
    },
    rods: {
        table: "rods",
        searchFields: ["name", "category", "type", "brend", "power", "test_down", "test_up", "length", "sensi", "rig", "stroy", "stren", "bonus_opit", "bonus_snast", "bonus_nav", "bonus_zabros", "lvl", "price_ser", "price_gold"],
        filterFields: ["name", "category", "type", "brend", "power", "test_down", "test_up", "length", "sensi", "rig", "stroy", "stren", "bonus_opit", "bonus_snast", "bonus_nav", "bonus_zabros", "lvl", "price_ser", "price_gold"],
        sortFields: { name: "name", category: "category", type: "type", brend: "brend", power: "power", test_down: "test_down", test_up: "test_up", length: "length", sensi: "sensi", rig: "rig", stroy: "stroy", stren: "stren", bonus_opit: "bonus_opit", bonus_snast: "bonus_snast", bonus_nav: "bonus_nav", bonus_zabros: "bonus_zabros", lvl: "lvl", price_ser: "price_ser", price_gold: "price_gold", id: "id" },
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
        where.push(`concat_ws(' ', ${config.searchFields.map((field) => `COALESCE("${field}"::text, '')`).join(", ")}) ILIKE $${values.length}`);
    }

    if (query.filters) {
        let filters: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(query.filters);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) filters = parsed;
        } catch {
            // Invalid filter JSON is treated as no column filters.
        }
        for (const [field, rawValue] of Object.entries(filters)) {
            if (!config.filterFields.includes(field) || typeof rawValue !== "string" || !rawValue.trim()) continue;
            values.push(`%${rawValue.trim()}%`);
            where.push(`COALESCE("${field}"::text, '') ILIKE $${values.length}`);
        }
    }

    for (const field of ["category", "brend", "type"]) {
        if (!config.filterFields.includes(field)) continue;
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
    const isNumericVarchar = numericSortColumns[type].has(sortColumn);
    // For numeric-VARCHAR fields, extract the first signed number (e.g. "5,2:1" → 5.2, "0-100 гр" → 0)
    // and sort by it. RF4 data uses comma as decimal separator, so we normalize "," → "." before cast.
    // The regex uses a non-capturing group so substring() returns the full match (PG returns capture group #1
    // otherwise, which would give us ".2" or NULL — broken sort).
    // NULLS LAST so rows missing the field don't dominate the start in DESC order.
    const sortExpr = isNumericVarchar
        ? `NULLIF(replace(substring("${sortColumn}" FROM '-?[0-9]+(?:[.,][0-9]+)?'), ',', '.'), '')::numeric ${sortDirection} NULLS LAST`
        : `"${sortColumn}" ${sortDirection}`;

    return {
        whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
        orderSql: `${sortExpr}, id ASC`,
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
