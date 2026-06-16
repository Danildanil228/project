import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItemListQuery } from "./items-service";

test("builds a filtered reels query with search, filter and level range", () => {
    const result = buildItemListQuery("reels", {
        search: "raptor",
        category: "Силовые",
        brend: "",
        type: "",
        minLvl: 10,
        maxLvl: undefined,
        sortBy: "lvl",
        sortDirection: "desc",
        limit: 24,
        offset: 0,
    });

    assert.equal(result.whereSql, "WHERE name ILIKE $1 AND category = $2 AND lvl >= $3");
    assert.deepEqual(result.values, ["%raptor%", "Силовые", 10]);
    assert.equal(result.orderSql, "lvl DESC, id ASC");
});

test("rods support the type filter and fall back to default sort", () => {
    const result = buildItemListQuery("rods", {
        search: "",
        category: "",
        brend: "Reef",
        type: "Спиннинговые",
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
