import { z } from "zod";

export const commentBodySchema = z.object({
    body: z.string().trim().min(1).max(2000),
});

export const commentIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
    commentId: z.coerce.number().int().positive(),
});

export const reactionBodySchema = z.object({
    // 1 = like, -1 = dislike. Sending the same value again clears it (toggle).
    value: z.union([z.literal(1), z.literal(-1)]),
});

export const reportBodySchema = z.object({
    reason: z.string().trim().min(1).max(500),
});

export const reportIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const reportResolveSchema = z.object({
    status: z.enum(["resolved", "rejected"]),
});

export const reportQuerySchema = z.object({
    status: z.enum(["open", "resolved", "rejected"]).or(z.literal("")).optional().default("open"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export const paginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export const notificationQuerySchema = z.object({
    unreadOnly: z.enum(["true", "false"]).optional().default("false"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export const markReadSchema = z.object({
    ids: z.array(z.coerce.number().int().positive()).max(100).optional(),
});
