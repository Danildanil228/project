import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsertQuery, buildItemListQuery, buildUpdateQuery } from "./items-service";

test("builds a filtered reels query with search, filter and level range", () => {
    const result = buildItemListQuery("reels", {
        search: "raptor",
        category: "Силовые",
        brend: "",
        type: "",
        filters: "",
        minLvl: 10,
        maxLvl: undefined,
        sortBy: "lvl",
        sortDirection: "desc",
        limit: 24,
        offset: 0,
    });

    assert.match(result.whereSql, /^WHERE concat_ws\(' ', .*\) ILIKE \$1 AND category = \$2 AND lvl >= \$3$/);
    assert.deepEqual(result.values, ["%raptor%", "Силовые", 10]);
    assert.equal(result.orderSql, "lvl DESC, id ASC");
});

test("rods support the type filter and fall back to default sort", () => {
    const result = buildItemListQuery("rods", {
        search: "",
        category: "",
        brend: "Reef",
        type: "Спиннинговые",
        filters: "",
        minLvl: undefined,
        maxLvl: undefined,
        sortBy: "name",
        sortDirection: "asc",
        limit: 24,
        offset: 0,
    });

    assert.equal(result.whereSql, "WHERE brend = $1 AND type = $2");
    assert.deepEqual(result.values, ["Reef", "Спиннинговые"]);
    assert.equal(result.orderSql, "name ASC, id ASC");
});

test("ignores the type filter for reels (not a reels column)", () => {
    const result = buildItemListQuery("reels", {
        search: "",
        category: "",
        brend: "",
        type: "Спиннинговые",
        filters: "",
        minLvl: undefined,
        maxLvl: undefined,
        sortBy: "name",
        sortDirection: "asc",
        limit: 24,
        offset: 0,
    });

    assert.equal(result.whereSql, "");
    assert.deepEqual(result.values, []);
});

test("builds a parameterised insert query in field order", () => {
    const { sql, values } = buildInsertQuery("reels", { name: "Test", category: "Силовые", lvl: 10 });

    assert.equal(sql, `INSERT INTO reels ("name", "category", "lvl") VALUES ($1, $2, $3) RETURNING *`);
    assert.deepEqual(values, ["Test", "Силовые", 10]);
});

test("builds a parameterised update query with id as the last value", () => {
    const { sql, values } = buildUpdateQuery("rods", 7, { brend: "Reef", lvl: 20 });

    assert.equal(sql, `UPDATE rods SET "brend" = $1, "lvl" = $2 WHERE id = $3 RETURNING *`);
    assert.deepEqual(values, ["Reef", 20, 7]);
});

test("supports whitelisted column filters and attribute sorting", () => {
    const result = buildItemListQuery("reels", {
        search: "",
        category: "",
        brend: "",
        type: "",
        filters: JSON.stringify({ frik: "20", protection: "true", injected: "ignored" }),
        minLvl: undefined,
        maxLvl: undefined,
        sortBy: "frik",
        sortDirection: "desc",
        limit: 50,
        offset: 0,
    });

    assert.equal(result.whereSql, `WHERE COALESCE("frik"::text, '') ILIKE $1 AND COALESCE("protection"::text, '') ILIKE $2`);
    assert.deepEqual(result.values, ["%20%", "%true%"]);
    assert.equal(result.orderSql, "frik DESC, id ASC");
});
