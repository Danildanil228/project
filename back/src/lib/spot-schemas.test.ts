import assert from "node:assert/strict";
import test from "node:test";
import { invalidWaterbodyFishIds, spotCreateSchema, spotListQuerySchema } from "./spot-schemas";

test("spotCreateSchema normalises optional values and de-duplicates relations", () => {
    const result = spotCreateSchema.parse({
        waterbodyId: "2",
        name: "  Яма у острова  ",
        description: "",
        mapX: "25.5",
        mapY: "72",
        depth: "8.4",
        gameCoordinateX: "",
        fishIds: [3, 3, 4],
        baitIds: [8, 8],
    });

    assert.equal(result.name, "Яма у острова");
    assert.equal(result.description, null);
    assert.equal(result.depth, 8.4);
    assert.equal(result.gameCoordinateX, null);
    assert.deepEqual(result.fishIds, [3, 4]);
    assert.deepEqual(result.baitIds, [8]);
    assert.equal(result.isActive, true);
});

test("spotCreateSchema rejects marker coordinates outside the map", () => {
    assert.equal(spotCreateSchema.safeParse({ waterbodyId: 1, name: "Test", mapX: 101, mapY: 20 }).success, false);
});

test("spotListQuerySchema parses admin visibility flag", () => {
    const result = spotListQuerySchema.parse({ waterbodyId: "4", includeInactive: "true" });
    assert.equal(result.waterbodyId, 4);
    assert.equal(result.includeInactive, true);
});

test("invalidWaterbodyFishIds finds fish that do not inhabit the waterbody", () => {
    assert.deepEqual(invalidWaterbodyFishIds([2, 4, 7], [1, 2, 7]), [4]);
    assert.deepEqual(invalidWaterbodyFishIds([], [1, 2]), []);
});
