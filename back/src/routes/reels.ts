import { Router } from "express";
import { pool } from "../lib/db";

const router = Router();

router.get("/", async (req, res, next) => {
    try {
        const { rows } = await pool.query("SELECT * FROM reels");
        res.json({ reels: rows });
    } catch (error) {
        next(error);
    }
});

export const reelsRouter = router;
