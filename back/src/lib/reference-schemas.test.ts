import { test } from "node:test";
import assert from "node:assert/strict";
import { fishCreateSchema, waterbodyCreateSchema } from "./reference-schemas";

test("fishCreateSchema accepts a valid fish and rejects an unknown rarity", () => {
    const ok = fishCreateSchema.safeParse({ name: "Карась", rarity: "Обычный", photo: "" });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.photo, null); // empty string normalised to null

    const bad = fishCreateSchema.safeParse({ name: "Карась", rarity: "Эпический" });
    assert.equal(bad.success, false);
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
