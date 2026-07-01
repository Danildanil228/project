import assert from "node:assert/strict";
import test from "node:test";
import { invalidWaterbodyFishIds, isSimpleTrollingArea, spotCreateSchema, spotListQuerySchema } from "./spot-schemas";

test("spotCreateSchema normalises optional values and de-duplicates relations", () => {
    const result = spotCreateSchema.parse({
        waterbodyId: "2",
        name: "  Яма у острова  ",
        description: "",
        mapX: "25.5",
        mapY: "72",
        gameCoordinateX: "",
        trollingArea: null,
        variants: [{
            fishingMethod: "Донка",
            depth: "8.4",
            fishIds: [3, 3, 4],
            baitIds: [8, 8],
        }],
    });

    assert.equal(result.name, "Яма у острова");
    assert.equal(result.description, null);
    assert.equal(result.variants[0].depth, 8.4);
    assert.equal(result.gameCoordinateX, null);
    assert.deepEqual(result.variants[0].fishIds, [3, 4]);
    assert.deepEqual(result.variants[0].baitIds, [8]);
    assert.equal(result.isActive, true);
});

test("spotCreateSchema rejects marker coordinates outside the map", () => {
    assert.equal(spotCreateSchema.safeParse({ waterbodyId: 1, name: "Test", mapX: 101, mapY: 20 }).success, false);
});

test("trolling spots require a simple area and trolling variants", () => {
    const base = {
        waterbodyId: 1,
        name: "Trolling",
        geometryType: "trolling",
        mapX: 50,
        mapY: 50,
        trollingArea: [{ mapX: 10, mapY: 10 }, { mapX: 80, mapY: 10 }, { mapX: 50, mapY: 80 }],
        variants: [{ fishingMethod: "Троллинг", fishIds: [1], baitIds: [2] }],
    };
    assert.equal(spotCreateSchema.safeParse(base).success, true);
    assert.equal(spotCreateSchema.safeParse({ ...base, variants: [{ fishingMethod: "Донка" }] }).success, false);
    assert.equal(spotCreateSchema.safeParse({ ...base, trollingArea: base.trollingArea.slice(0, 2) }).success, false);
});

test("trolling area rejects self-intersecting polygons", () => {
    assert.equal(isSimpleTrollingArea([
        { mapX: 10, mapY: 10 },
        { mapX: 90, mapY: 90 },
        { mapX: 90, mapY: 10 },
        { mapX: 10, mapY: 90 },
    ]), false);
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
