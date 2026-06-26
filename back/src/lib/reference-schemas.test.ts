import { test } from "node:test";
import assert from "node:assert/strict";
import { fishBulkCreateSchema, fishCreateSchema, referenceListQuerySchema, waterbodyCreateSchema } from "./reference-schemas";

test("fishCreateSchema accepts a valid fish and rejects an unknown rarity", () => {
    const ok = fishCreateSchema.safeParse({ name: "Карась", rarity: "Обычный", photo: "", waterbodyIds: [2, 2, "3"], trophyWeightGrams: "1500", rareTrophyWeightGrams: 2500 });
    assert.equal(ok.success, true);
    if (ok.success) {
        assert.equal(ok.data.photo, null); // empty string normalised to null
        assert.deepEqual(ok.data.waterbodyIds, [2, 3]);
        assert.equal(ok.data.trophyWeightGrams, 1500);
    }

    const bad = fishCreateSchema.safeParse({ name: "Карась", rarity: "Эпический" });
    assert.equal(bad.success, false);
});

test("fishBulkCreateSchema rejects duplicate names within one batch", () => {
    const result = fishBulkCreateSchema.safeParse({
        items: [
            { name: "Лещ", rarity: "Обычный", waterbodyIds: [1], trophyWeightGrams: 3000, rareTrophyWeightGrams: 5000 },
            { name: " лещ ", rarity: "Редкий", waterbodyIds: [2], trophyWeightGrams: 3000, rareTrophyWeightGrams: 5000 },
        ],
    });
    assert.equal(result.success, false);
});

test("fishCreateSchema validates trophy weight order", () => {
    const result = fishCreateSchema.safeParse({
        name: "Лещ",
        rarity: "Обычный",
        trophyWeightGrams: 5000,
        rareTrophyWeightGrams: 3000,
    });
    assert.equal(result.success, false);
});

test("referenceListQuerySchema accepts a waterbody habitat filter", () => {
    const result = referenceListQuerySchema.parse({ waterbodyId: "15", rarity: "", limit: "50" });
    assert.equal(result.waterbodyId, 15);
    assert.equal(result.limit, 50);
});

test("waterbodyCreateSchema coerces and de-duplicates fish ids", () => {
    const result = waterbodyCreateSchema.safeParse({ name: "Старый Острог", fishIds: ["1", 1, 2, 2, 3] });
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data.fishIds, [1, 2, 3]);
});

test("waterbodyCreateSchema defaults fishIds to an empty array", () => {
    const result = waterbodyCreateSchema.safeParse({ name: "Пруд" });
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data.fishIds, []);
});

test("waterbodyCreateSchema validates complete coordinate calibration", () => {
    const valid = waterbodyCreateSchema.safeParse({
        name: "оз. Комариное",
        coordinateMinX: 33,
        coordinateMinY: 37,
        coordinateMaxX: 108,
        coordinateMaxY: 112,
    });
    assert.equal(valid.success, true);

    const incomplete = waterbodyCreateSchema.safeParse({ name: "Озеро", coordinateMinX: 10 });
    assert.equal(incomplete.success, false);
});
