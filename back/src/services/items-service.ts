import type { z } from "zod";
import { pool } from "../lib/db";
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
