import assert from "node:assert/strict";
import { test } from "node:test";
import { mapSubmissionApproveSchema, mapSubmissionListSchema } from "./map-submission-schemas";

test("map submission approval coerces coordinates and de-duplicates baits", () => {
    const result = mapSubmissionApproveSchema.safeParse({
        name: "  Точка 75:88  ",
        mapX: "50",
        mapY: "40",
        gameCoordinateX: "75",
        gameCoordinateY: "88",
        targets: [{ fishId: "2", baitIds: [4, 4, 5] }],
    });
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.name, "Точка 75:88");
        assert.deepEqual(result.data.targets[0], { fishId: 2, baitIds: [4, 5] });
    }
});

test("map submission approval rejects duplicate fish targets", () => {
    const result = mapSubmissionApproveSchema.safeParse({
        name: "Точка",
        mapX: 50,
        mapY: 40,
        gameCoordinateX: 75,
        gameCoordinateY: 88,
        targets: [{ fishId: 2 }, { fishId: 2 }],
    });
    assert.equal(result.success, false);
});

test("map submission list defaults to pending", () => {
    const result = mapSubmissionListSchema.parse({});
    assert.equal(result.status, "pending");
});
