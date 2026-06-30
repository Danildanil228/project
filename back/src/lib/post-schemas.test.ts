import { test } from "node:test";
import assert from "node:assert/strict";
import { createPostSchema, feedQuerySchema, incomePerHour, parseFeedSearch } from "./post-schemas";

test("incomePerHour computes silver per hour, or null when data is missing", () => {
    assert.equal(incomePerHour(6000, 120), 3000);
    assert.equal(incomePerHour(1000, 30), 2000);
    assert.equal(incomePerHour(null, 60), null);
    assert.equal(incomePerHour(5000, null), null);
});

test("createPostSchema normalises empty fields and coerces catches", () => {
    const result = createPostSchema.safeParse({
        description: "  Хороший выезд  ",
        waterbodyId: "13",
        point: "",
        fishingMethod: "Спиннинг",
        income: "5000",
        fishingMinutes: "",
        catches: [{ fishId: "4" }],
        media: ["http://x/1.png"],
        submit: true,
    });

    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.waterbodyId, 13);
        assert.equal(result.data.point, null);
        assert.equal(result.data.fishingMinutes, null);
        assert.deepEqual(result.data.catches[0], { fishId: 4, trophyType: "normal", baitIds: [] });
        assert.equal(result.data.baitMode, "common");
        assert.deepEqual(result.data.commonBaitIds, []);
        assert.equal(result.data.submit, true);
    }
});

test("createPostSchema accepts a trophy type for every catch", () => {
    const result = createPostSchema.safeParse({
        catches: [
            { fishId: 4, trophyType: "trophy" },
            { fishId: 5, trophyType: "rare_trophy" },
        ],
    });

    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.catches[0].trophyType, "trophy");
        assert.equal(result.data.catches[1].trophyType, "rare_trophy");
    }
});

test("parseFeedSearch extracts trophy markers and keeps the fish query", () => {
    assert.deepEqual(parseFeedSearch("трофей пикша"), { text: "пикша", trophyType: "trophy" });
    assert.deepEqual(parseFeedSearch("супер трофей пикша"), { text: "пикша", trophyType: "rare_trophy" });
    assert.deepEqual(parseFeedSearch("редкий трофей палтус"), { text: "палтус", trophyType: "rare_trophy" });
    assert.deepEqual(parseFeedSearch("Ладожское озеро"), { text: "Ладожское озеро", trophyType: null });
});

test("feed sorting accepts trophy-first modes", () => {
    assert.equal(feedQuerySchema.parse({ sortBy: "rareTrophy" }).sortBy, "rareTrophy");
    assert.equal(feedQuerySchema.parse({ sortBy: "trophy" }).sortBy, "trophy");
});

test("createPostSchema requires a complete map location", () => {
    const result = createPostSchema.safeParse({ mapX: 50, mapY: 40, gameCoordinateX: 75 });
    assert.equal(result.success, false);
});

test("createPostSchema rejects more than 8 media items", () => {
    const result = createPostSchema.safeParse({
        media: Array.from({ length: 9 }, (_, index) => `http://x/${index}.png`),
    });
    assert.equal(result.success, false);
});
