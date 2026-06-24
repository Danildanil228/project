import { Router } from "express";
import { pool } from "../lib/db";

export const calculatorRouter = Router();

// Returns the minimal payload the strength calculator needs: id, name, category,
// and the durability field (rods.stren, reels.meh). Both rods and reels in one round-trip.
// Public — no auth, no rate-limit beyond the global one.
calculatorRouter.get("/items", async (_req, res, next) => {
    try {
        const [rods, reels] = await Promise.all([
            pool.query<{ id: number; name: string; category: string; type: string | null; stren: string | null }>(
                `SELECT id, name, category, type, stren FROM rods WHERE stren IS NOT NULL AND stren <> '' ORDER BY name ASC`,
            ),
            pool.query<{ id: number; name: string; category: string; meh: string | null; meh_mod: string | null }>(
                `SELECT id, name, category, meh, meh_mod FROM reels WHERE meh IS NOT NULL AND meh <> '' ORDER BY name ASC`,
            ),
        ]);
        res.json({ rods: rods.rows, reels: reels.rows });
    } catch (error) {
        next(error);
    }
});
