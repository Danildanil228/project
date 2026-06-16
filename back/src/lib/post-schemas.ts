import { z } from "zod";

export const fishingMethods = ["Поплавок", "Донка", "Спиннинг", "Морская"] as const;

const emptyToNull = (value: unknown) => (value === "" || value === undefined ? null : value);

const catchInputSchema = z.object({
    fishId: z.coerce.number().int().positive(),
    weight: z.preprocess(emptyToNull, z.coerce.number().min(0).max(1_000_000).nullable()),
    quantity: z.coerce.number().int().min(1).max(100_000).default(1),
});

export const postContentSchema = z.object({
    description: z.string().trim().max(5000).optional().default(""),
    waterbodyId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
    point: z.preprocess(emptyToNull, z.string().trim().max(50).nullable()),
    fishingMethod: z.preprocess(emptyToNull, z.enum(fishingMethods).nullable()),
    income: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(1_000_000_000).nullable()),
    fishingMinutes: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(100_000).nullable()),
    catches: z.array(catchInputSchema).max(50).optional().default([]),
    media: z.array(z.string().trim().min(1).max(255)).max(8).optional().default([]),
});

export const createPostSchema = postContentSchema.extend({
    submit: z.boolean().optional().default(false),
    // Only honoured for admin/moderator/super-admin: publish without review.
    skipModeration: z.boolean().optional().default(false),
});

export const rejectSchema = z.object({
    reason: z.string().trim().min(1).max(500),
});

export const moderationQueueQuerySchema = z.object({
    status: z.enum(["pending", "in_review"]).or(z.literal("")).optional().default(""),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export const postIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const myPostsQuerySchema = z.object({
    status: z
        .enum(["draft", "pending", "in_review", "approved", "rejected", "deleted"])
        .or(z.literal(""))
        .optional()
        .default(""),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

const toNumberArray = (value: unknown) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) {
        return value.split(",").map((part) => part.trim()).filter(Boolean);
    }
    return [];
};

export const feedQuerySchema = z.object({
    search: z.string().trim().max(100).optional().default(""),
    fishIds: z.preprocess(toNumberArray, z.array(z.coerce.number().int().positive()).max(50)),
    waterbodyIds: z.preprocess(toNumberArray, z.array(z.coerce.number().int().positive()).max(50)),
    fishingMethod: z.enum(fishingMethods).or(z.literal("")).optional().default(""),
    sortBy: z.enum(["date", "incomePerHour"]).optional().default("date"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export const authorIdParamsSchema = z.object({
    authorId: z.string().trim().min(1).max(100),
});

export const paginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

// Computes silver-per-hour from total income and fishing time, or null when either is missing.
export function incomePerHour(income: number | null, minutes: number | null) {
    if (!income || !minutes) return null;
    return Math.round((income * 60) / minutes);
}
