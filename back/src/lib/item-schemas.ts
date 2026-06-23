import { z } from "zod";
import type { ItemType } from "../services/items-service";

const reelSizes = [10, 20, 30, 40, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000, 20000, 30000];

const requiredText = (max: number) => z.string().trim().min(1).max(max);

// Optional text: "" / undefined become null so empty form fields clear the column.
const optionalText = (max: number) =>
    z.preprocess((value) => (value === "" || value === undefined ? null : value), z.string().trim().max(max).nullable());

export const reelCreateSchema = z.object({
    name: requiredText(100),
    category: z.enum(["Безинерционные", "Байткастинговые", "Силовые", "Низкопрофильные"]),
    brend: requiredText(100),
    size: z.preprocess(
        (value) => (value === "" || value === undefined ? null : value),
        z.coerce.number().int().refine((n) => reelSizes.includes(n), "Недопустимый размер катушки").nullable(),
    ),
    test: requiredText(50),
    test_mod: optionalText(50),
    protection: z.boolean().optional().default(false),
    per: requiredText(50),
    per_mod: optionalText(50),
    speed: requiredText(50),
    speed_mod: optionalText(50),
    frik: requiredText(50),
    frik_mod: optionalText(50),
    meh: requiredText(50),
    meh_mod: optionalText(50),
    lvl: z.preprocess(
        (value) => (value === "" || value === undefined ? null : value),
        z.coerce.number().int().min(0).max(1000).nullable(),
    ),
    price_ser: optionalText(50),
    price_gold: optionalText(50),
    capacity: optionalText(50),
    capacity_mod: optionalText(50),
    photo: optionalText(500),
    model: optionalText(100),
});

export const rodCreateSchema = z.object({
    name: requiredText(100),
    category: z.enum(["Спининговые", "Доночные", "Поплавочные", "Морские"]),
    type: requiredText(100),
    brend: requiredText(100),
    power: optionalText(20),
    test_down: requiredText(10),
    test_up: requiredText(10),
    length: requiredText(10),
    sensi: requiredText(10),
    rig: requiredText(10),
    stroy: z.enum(["Быстрый", "Медленный", "Сверхбыстрый", "Средний"]),
    bonus_opit: optionalText(10),
    bonus_snast: optionalText(100),
    bonus_nav: optionalText(10),
    bonus_zabros: optionalText(10),
    stren: requiredText(10),
    lvl: z.coerce.number().int().min(0).max(1000),
    price_ser: optionalText(20),
    price_gold: optionalText(10),
    photo: optionalText(100),
});

export const reelUpdateSchema = reelCreateSchema.partial();
export const rodUpdateSchema = rodCreateSchema.partial();

export const itemCreateSchemas: Record<ItemType, z.ZodType> = {
    reels: reelCreateSchema,
    rods: rodCreateSchema,
};

export const itemUpdateSchemas: Record<ItemType, z.ZodType> = {
    reels: reelUpdateSchema,
    rods: rodUpdateSchema,
};
