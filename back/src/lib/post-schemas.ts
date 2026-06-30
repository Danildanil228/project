import { z } from "zod";

export const fishingMethods = ["Поплавок", "Донка", "Спиннинг", "Морская"] as const;
export const catchTrophyTypes = ["normal", "trophy", "rare_trophy"] as const;

const emptyToNull = (value: unknown) => (value === "" || value === undefined ? null : value);

const catchInputSchema = z.object({
    fishId: z.coerce.number().int().positive(),
    trophyType: z.enum(catchTrophyTypes).optional().default("normal"),
    baitIds: z.array(z.coerce.number().int().positive()).max(50).optional().default([]).transform((ids) => [...new Set(ids)]),
});

const optionalCoordinate = z.preprocess(emptyToNull, z.coerce.number().min(-999999.99).max(999999.99).nullable());
const optionalMapPercent = z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable());

export const postContentSchema = z.object({
    description: z.string().trim().max(5000).optional().default(""),
    waterbodyId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
    point: z.preprocess(emptyToNull, z.string().trim().max(50).nullable()),
    fishingMethod: z.preprocess(emptyToNull, z.enum(fishingMethods).nullable()),
    income: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(1_000_000_000).nullable()),
    fishingMinutes: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(100_000).nullable()),
    catches: z.array(catchInputSchema).max(50).optional().default([]),
    baitMode: z.enum(["common", "per_fish"]).optional().default("common"),
    commonBaitIds: z.array(z.coerce.number().int().positive()).max(50).optional().default([]).transform((ids) => [...new Set(ids)]),
    proposedSpotId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
    mapX: optionalMapPercent,
    mapY: optionalMapPercent,
    gameCoordinateX: optionalCoordinate,
    gameCoordinateY: optionalCoordinate,
    // Optional second point — only set in trolling mode (post represents an A→B run).
    mapX2: optionalMapPercent,
    mapY2: optionalMapPercent,
    gameCoordinateX2: optionalCoordinate,
    gameCoordinateY2: optionalCoordinate,
    media: z.array(z.string().trim().min(1).max(255)).max(8).optional().default([]),
}).superRefine((data, context) => {
    const start = [data.mapX, data.mapY, data.gameCoordinateX, data.gameCoordinateY];
    if (!start.every((value) => value === null) && start.some((value) => value === null)) {
        context.addIssue({ code: "custom", path: ["mapX"], message: "Для точки укажите обе координаты" });
    }
    const end = [data.mapX2, data.mapY2, data.gameCoordinateX2, data.gameCoordinateY2];
    if (!end.every((value) => value === null) && end.some((value) => value === null)) {
        context.addIssue({ code: "custom", path: ["mapX2"], message: "Для конечной точки троллинга укажите обе координаты" });
    }
    // Trolling end point makes no sense without a start point.
    if (end.some((value) => value !== null) && start.every((value) => value === null)) {
        context.addIssue({ code: "custom", path: ["mapX2"], message: "Сначала укажите точку A" });
    }
});

export const createPostSchema = postContentSchema.extend({
    submit: z.boolean().optional().default(false),
    // Only honoured for admin/moderator/super-admin: publish without review.
    skipModeration: z.boolean().optional().default(false),
    // Curated / community posts: live in the public feed without a clickable author. Only
    // moderator+ may set this; the service layer enforces the role check and forces status
    // to 'approved' regardless of `submit`.
    isCurated: z.boolean().optional().default(false),
    curatedLabel: z.preprocess(emptyToNull, z.string().trim().max(60).nullable()),
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
    trophyType: z.enum(["trophy", "rare_trophy"]).or(z.literal("")).optional().default(""),
    sortBy: z.enum(["date", "incomePerHour", "rareTrophy", "trophy"]).optional().default("date"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export function parseFeedSearch(search: string) {
    let text = search.trim().replace(/\s+/g, " ");
    let trophyType: "trophy" | "rare_trophy" | null = null;

    const rareMarker = /(^|\s)(?:супер\s*трофе\p{L}*|супертрофе\p{L}*|редк\p{L}*\s+трофе\p{L}*)(?=\s|$)/iu;
    const trophyMarker = /(^|\s)трофе\p{L}*(?=\s|$)/iu;
    if (rareMarker.test(text)) {
        trophyType = "rare_trophy";
        text = text.replace(rareMarker, " ");
    } else if (trophyMarker.test(text)) {
        trophyType = "trophy";
        text = text.replace(trophyMarker, " ");
    }

    return { text: text.trim().replace(/\s+/g, " "), trophyType };
}

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
