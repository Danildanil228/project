import assert from "node:assert/strict";
import test from "node:test";
import { baitCreateSchema, baitListQuerySchema } from "./bait-schemas";

test("baitCreateSchema normalises catalog fields and defaults active state", () => {
    const result = baitCreateSchema.parse({
        name: "  Bloodworm  ",
        domain: "bait",
        categoryCode: "larvae",
        familyId: "",
        systemId: "",
        variantCode: "",
        quality: "",
        description: "",
        photo: "",
    });
    assert.deepEqual(result, {
        name: "Bloodworm",
        domain: "bait",
        categoryCode: "larvae",
        familyId: null,
        systemId: null,
        variantCode: null,
        quality: null,
        description: null,
        photo: null,
        isActive: true,
    });
});

test("baitCreateSchema rejects a category from another domain", () => {
    assert.equal(baitCreateSchema.safeParse({ name: "Test", domain: "bait", categoryCode: "wobblers" }).success, false);
});

test("baitListQuerySchema parses catalog filters and pagination", () => {
    const result = baitListQuerySchema.parse({ domain: "lure", categoryCode: "wobblers", familyId: "3", includeInactive: "true", limit: "20", offset: "5" });
    assert.equal(result.domain, "lure");
    assert.equal(result.categoryCode, "wobblers");
    assert.equal(result.familyId, 3);
    assert.equal(result.includeInactive, true);
    assert.equal(result.limit, 20);
    assert.equal(result.offset, 5);
});
