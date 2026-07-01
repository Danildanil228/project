import { z } from "zod";

export function invalidWaterbodyFishIds(requestedIds: number[], allowedIds: number[]) {
    const allowed = new Set(allowedIds);
    return requestedIds.filter((id) => !allowed.has(id));
}

const optionalText = (max: number) =>
    z.preprocess((value) => (value === "" || value === undefined ? null : value), z.string().trim().max(max).nullable());

const optionalNumber = <T extends z.ZodType>(schema: T) =>
    z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

const uniqueIds = z
    .array(z.coerce.number().int().positive())
    .max(500)
    .optional()
    .default([])
    .transform((ids) => Array.from(new Set(ids)));

export const spotFishingMethods = ["Поплавок", "Донка", "Спиннинг", "Морская", "Троллинг"] as const;

const mapPointSchema = z.object({
    mapX: z.coerce.number().min(0).max(100),
    mapY: z.coerce.number().min(0).max(100),
});

export const spotVariantSchema = z.object({
    fishingMethod: z.enum(spotFishingMethods),
    description: optionalText(1000),
    depth: optionalNumber(z.coerce.number().min(0).max(9999.99)),
    clipDistance: optionalNumber(z.coerce.number().int().min(0).max(100000)),
    fishIds: uniqueIds,
    baitIds: uniqueIds,
});

export const spotVariantsCreateSchema = z.object({
    variants: z.array(spotVariantSchema).min(1).max(20),
});

export function isSimpleTrollingArea(points: Array<{ mapX: number; mapY: number }>) {
    if (points.length < 3) return false;
    const unique = new Set(points.map((point) => `${point.mapX.toFixed(4)}:${point.mapY.toFixed(4)}`));
    if (unique.size < 3) return false;

    const area = Math.abs(points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.mapX * next.mapY - next.mapX * point.mapY;
    }, 0)) / 2;
    if (area < 0.01) return false;

    const orientation = (a: typeof points[number], b: typeof points[number], c: typeof points[number]) =>
        Math.sign((b.mapY - a.mapY) * (c.mapX - b.mapX) - (b.mapX - a.mapX) * (c.mapY - b.mapY));
    const intersects = (a: typeof points[number], b: typeof points[number], c: typeof points[number], d: typeof points[number]) =>
        orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);

    for (let left = 0; left < points.length; left += 1) {
        const leftNext = (left + 1) % points.length;
        for (let right = left + 1; right < points.length; right += 1) {
            const rightNext = (right + 1) % points.length;
            if (left === right || leftNext === right || rightNext === left) continue;
            if (intersects(points[left], points[leftNext], points[right], points[rightNext])) return false;
        }
    }
    return true;
}

const spotPayloadSchema = z.object({
    name: z.string().trim().min(1).max(150),
    description: optionalText(3000),
    geometryType: z.enum(["point", "trolling"]).default("point"),
    mapX: z.coerce.number().min(0).max(100),
    mapY: z.coerce.number().min(0).max(100),
    gameCoordinateX: optionalNumber(z.coerce.number().min(-999999.99).max(999999.99)),
    gameCoordinateY: optionalNumber(z.coerce.number().min(-999999.99).max(999999.99)),
    trollingArea: z.preprocess((value) => (value === undefined ? null : value), z.array(mapPointSchema).min(3).max(30).nullable()),
    variants: z.array(spotVariantSchema).min(1).max(20),
    isActive: z.boolean().optional().default(true),
}).superRefine((data, context) => {
    if (data.geometryType === "trolling") {
        if (!data.trollingArea || !isSimpleTrollingArea(data.trollingArea)) {
            context.addIssue({ code: "custom", path: ["trollingArea"], message: "Зона троллинга должна быть простым многоугольником минимум из трёх точек" });
        }
        if (data.variants.some((variant) => variant.fishingMethod !== "Троллинг")) {
            context.addIssue({ code: "custom", path: ["variants"], message: "Для зоны троллинга доступны только троллинговые способы ловли" });
        }
    } else {
        if (data.trollingArea !== null) {
            context.addIssue({ code: "custom", path: ["trollingArea"], message: "У обычной точки не может быть зоны троллинга" });
        }
        if (data.variants.some((variant) => variant.fishingMethod === "Троллинг")) {
            context.addIssue({ code: "custom", path: ["variants"], message: "Троллинг нужно создавать как отдельную зону" });
        }
    }
});

export const spotCreateSchema = z.object({ waterbodyId: z.coerce.number().int().positive() }).and(spotPayloadSchema);

export const spotUpdateSchema = spotPayloadSchema;

export const spotListQuerySchema = z.object({
    waterbodyId: z.coerce.number().int().positive(),
    includeInactive: z.preprocess((value) => value === "true", z.boolean()),
});

export const spotIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
