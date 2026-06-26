import { z } from "zod";

export const baitDomains = ["bait", "lure"] as const;

export const baitCategoryCodes = [
    "sets", "worms", "larvae", "insects", "crustaceans", "porridge_dough", "natural", "live", "live_fish",
    "nuts", "sinking_boilies", "pop_up_boilies", "pellets", "artificial_corn", "zig_rig_foam", "marine_bait",
    "dead_fish", "fish_fillet", "lure_sets", "wobblers", "spoons", "spinners", "spinnerbaits", "topwater",
    "jerkbaits", "skirted_jigs", "soft_plastic", "wacky_worms", "pilkers", "giant_shads", "gummi_makk",
    "octopus", "shrimp", "silicon_sea_worms", "attraction_elements", "tube_baits", "dead_fish_jigheads",
    "flies", "artificial_rodents",
] as const;

export const baitQualities = ["hq", "mq", "lq"] as const;

const baitCategories = new Set([
    "sets", "worms", "larvae", "insects", "crustaceans", "porridge_dough", "natural", "live", "live_fish",
    "nuts", "sinking_boilies", "pop_up_boilies", "pellets", "artificial_corn", "zig_rig_foam", "marine_bait",
    "dead_fish", "fish_fillet",
]);

const optionalText = (max: number) =>
    z.preprocess((value) => (value === "" || value === undefined ? null : value), z.string().trim().max(max).nullable());

const optionalPositiveId = z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().int().positive().nullable(),
);

const booleanFromQuery = z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false" || value === "" || value === undefined) return false;
    return value;
}, z.boolean());

const baitInputFields = z.object({
    name: z.string().trim().min(1).max(150),
    domain: z.enum(baitDomains),
    categoryCode: z.enum(baitCategoryCodes),
    familyId: optionalPositiveId,
    systemId: optionalText(150),
    variantCode: optionalText(100),
    quality: z.preprocess((value) => (value === "" || value === undefined ? null : value), z.enum(baitQualities).nullable()),
    description: optionalText(2000),
    photo: optionalText(500),
    isActive: z.boolean().optional().default(true),
});

function validateDomainCategory(data: { domain?: "bait" | "lure"; categoryCode?: string }, context: z.RefinementCtx) {
    if (!data.domain || !data.categoryCode) return;
    const categoryIsBait = baitCategories.has(data.categoryCode);
    if ((data.domain === "bait") !== categoryIsBait) {
        context.addIssue({ code: "custom", path: ["categoryCode"], message: "Category does not belong to the selected domain" });
    }
}

export const baitCreateSchema = baitInputFields.superRefine(validateDomainCategory);
export const baitUpdateSchema = baitInputFields.partial().superRefine(validateDomainCategory);

export const baitListQuerySchema = z.object({
    search: z.string().trim().max(100).optional().default(""),
    domain: z.enum(baitDomains).or(z.literal("")).optional().default(""),
    categoryCode: z.enum(baitCategoryCodes).or(z.literal("")).optional().default(""),
    familyId: z.preprocess((value) => (value === "" || value === undefined ? null : value), z.coerce.number().int().positive().nullable()),
    includeInactive: booleanFromQuery,
    limit: z.coerce.number().int().min(1).max(5000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
});

export const baitIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
