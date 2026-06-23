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

export const spotCreateSchema = z.object({
    waterbodyId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(150),
    description: optionalText(3000),
    mapX: z.coerce.number().min(0).max(100),
    mapY: z.coerce.number().min(0).max(100),
    gameCoordinateX: optionalNumber(z.coerce.number().min(-999999.99).max(999999.99)),
    gameCoordinateY: optionalNumber(z.coerce.number().min(-999999.99).max(999999.99)),
    depth: optionalNumber(z.coerce.number().min(0).max(9999.99)),
    clipDistance: optionalNumber(z.coerce.number().int().min(0).max(100000)),
    fishIds: uniqueIds,
    baitIds: uniqueIds,
    isActive: z.boolean().optional().default(true),
});

export const spotUpdateSchema = spotCreateSchema.omit({ waterbodyId: true }).partial();

export const spotListQuerySchema = z.object({
    waterbodyId: z.coerce.number().int().positive(),
    includeInactive: z.preprocess((value) => value === "true", z.boolean()),
});

export const spotIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
