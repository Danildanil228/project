import type { Response } from "express";
import { z } from "zod";

export const appRoleSchema = z.enum(["admin", "moderator", "user"]);

export const userIdParamsSchema = z.object({
    userId: z.string().min(1),
});

export const roleBodySchema = z.object({
    role: appRoleSchema,
});

export const accountDeleteBodySchema = z.object({
    userId: z.string().min(1),
});

const userIdsSchema = z.array(z.string().min(1)).min(1).max(100).transform((items) => Array.from(new Set(items)));

export const bulkUserIdsSchema = z.object({
    userIds: userIdsSchema,
});

export const bulkRoleBodySchema = z.object({
    userIds: userIdsSchema,
    role: appRoleSchema,
});

export const bulkBanBodySchema = z.object({
    userIds: userIdsSchema,
    reason: z.string().trim().max(500).optional(),
    expiresAt: z.string().datetime().optional(),
});

export const listUsersQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
    searchValue: z.string().trim().max(200).optional().default(""),
    searchField: z.enum(["email", "name"]).optional().default("email"),
    role: z.enum(["admin", "moderator", "user"]).or(z.literal("")).optional().default(""),
    status: z.enum(["active", "banned"]).or(z.literal("")).optional().default(""),
    emailVerified: z.enum(["true", "false"]).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "email", "name", "role"]).optional().default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const auditLogQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
    targetUserId: z.string().trim().min(1).optional(),
    actorEmail: z.string().trim().max(200).optional(),
    targetEmail: z.string().trim().max(200).optional(),
    action: z.string().trim().max(120).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});

export const auditLogExportQuerySchema = auditLogQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(5000).default(5000),
});

export function parseOrSend<T>(schema: z.ZodType<T>, value: unknown, res: Response) {
    const result = schema.safeParse(value);

    if (!result.success) {
        res.status(400).json({
            message: "Validation failed",
            issues: result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
        return null;
    }

    return result.data;
}
