import { z } from "zod";

const ids = z.array(z.coerce.number().int().positive()).max(100).default([]).transform((values) => [...new Set(values)]);
export const mapSubmissionListSchema = z.object({
    status: z.enum(["pending", "approved", "rejected"]).or(z.literal("")).default("pending"),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
});
export const mapSubmissionIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const mapSubmissionApproveSchema = z.object({
    spotId: z.coerce.number().int().positive().nullable().optional().default(null),
    name: z.string().trim().min(1).max(150),
    mapX: z.coerce.number().min(0).max(100),
    mapY: z.coerce.number().min(0).max(100),
    gameCoordinateX: z.coerce.number().min(-999999.99).max(999999.99),
    gameCoordinateY: z.coerce.number().min(-999999.99).max(999999.99),
    targets: z.array(z.object({ fishId: z.coerce.number().int().positive(), baitIds: ids })).min(1).max(100),
}).superRefine((data, context) => {
    const fishIds = data.targets.map((target) => target.fishId);
    if (new Set(fishIds).size !== fishIds.length) context.addIssue({ code: "custom", path: ["targets"], message: "Каждую рыбу можно указать только один раз" });
});
export const mapSubmissionRejectSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
