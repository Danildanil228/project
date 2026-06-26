import { z } from "zod";

export const fishRarities = ["Обычный", "Редкий", "Редчайший"] as const;

const uniqueIds = z
    .array(z.coerce.number().int().positive())
    .max(500)
    .optional()
    .default([])
    .transform((ids) => Array.from(new Set(ids)));

const optionalText = (max: number) =>
    z.preprocess((value) => (value === "" || value === undefined ? null : value), z.string().trim().max(max).nullable());

const optionalCoordinate = z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().min(-999999.99).max(999999.99).nullable(),
);

const fishWeight = z.coerce.number().int().positive().max(100_000_000);

const fishSchema = z.object({
    name: z.string().trim().min(1).max(100),
    rarity: z.enum(fishRarities),
    photo: optionalText(255),
    waterbodyIds: uniqueIds,
    trophyWeightGrams: fishWeight,
    rareTrophyWeightGrams: fishWeight,
});

function validateFishWeights(
    data: { trophyWeightGrams?: number; rareTrophyWeightGrams?: number },
    context: z.RefinementCtx,
) {
    if (data.trophyWeightGrams !== undefined && data.rareTrophyWeightGrams !== undefined
        && data.rareTrophyWeightGrams < data.trophyWeightGrams) {
        context.addIssue({ code: "custom", path: ["rareTrophyWeightGrams"], message: "Вес редкого трофея не может быть меньше веса трофея" });
    }
}

export const fishCreateSchema = fishSchema.superRefine(validateFishWeights);

export const fishUpdateSchema = fishSchema.partial().superRefine(validateFishWeights);

export const fishBulkCreateSchema = z.object({
    items: z.array(fishCreateSchema).min(1).max(100),
}).superRefine(({ items }, context) => {
    const names = new Set<string>();
    items.forEach((item, index) => {
        const normalized = item.name.toLocaleLowerCase("ru");
        if (names.has(normalized)) {
            context.addIssue({ code: "custom", path: ["items", index, "name"], message: "Название рыбы повторяется в списке" });
        }
        names.add(normalized);
    });
});

const waterbodySchema = z.object({
    name: z.string().trim().min(1).max(100),
    photo: optionalText(255),
    coordinateMinX: optionalCoordinate,
    coordinateMinY: optionalCoordinate,
    coordinateMaxX: optionalCoordinate,
    coordinateMaxY: optionalCoordinate,
    fishIds: uniqueIds,
});

function validateCoordinateBounds(
    data: { coordinateMinX?: number | null; coordinateMinY?: number | null; coordinateMaxX?: number | null; coordinateMaxY?: number | null },
    context: z.RefinementCtx,
) {
    const values = [data.coordinateMinX, data.coordinateMinY, data.coordinateMaxX, data.coordinateMaxY];
    if (values.every((value) => value === undefined)) return;
    if (values.every((value) => value === null)) return;
    if (values.some((value) => value === undefined || value === null)) {
        context.addIssue({ code: "custom", message: "Укажите все четыре границы координат карты" });
        return;
    }
    if (data.coordinateMaxX! <= data.coordinateMinX! || data.coordinateMaxY! <= data.coordinateMinY!) {
        context.addIssue({ code: "custom", message: "Максимальные координаты должны быть больше минимальных" });
    }
}

export const waterbodyCreateSchema = waterbodySchema.superRefine(validateCoordinateBounds);

export const waterbodyUpdateSchema = waterbodySchema.partial().superRefine(validateCoordinateBounds);

export const referenceListQuerySchema = z.object({
    search: z.string().trim().max(100).optional().default(""),
    rarity: z.enum(fishRarities).or(z.literal("")).optional().default(""),
    waterbodyId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
});

export const referenceIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
