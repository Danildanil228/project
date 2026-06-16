import { z } from "zod";

export const fishRarities = ["Обычный", "Редкий", "Редчайший"] as const;

const optionalText = (max: number) =>
    z.preprocess((value) => (value === "" || value === undefined ? null : value), z.string().trim().max(max).nullable());

export const fishCreateSchema = z.object({
    name: z.string().trim().min(1).max(100),
    rarity: z.enum(fishRarities),
    photo: optionalText(255),
});

export const fishUpdateSchema = fishCreateSchema.partial();

export const waterbodyCreateSchema = z.object({
    name: z.string().trim().min(1).max(100),
    photo: optionalText(255),
    fishIds: z
        .array(z.coerce.number().int().positive())
        .max(500)
        .optional()
        .default([])
        .transform((ids) => Array.from(new Set(ids))),
});

export const waterbodyUpdateSchema = waterbodyCreateSchema.partial();

export const referenceListQuerySchema = z.object({
    search: z.string().trim().max(100).optional().default(""),
    rarity: z.enum(fishRarities).or(z.literal("")).optional().default(""),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
});

export const referenceIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
