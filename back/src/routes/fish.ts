import { Router } from "express";
import { requireRole, type SessionUser } from "../lib/admin-auth";
import { fishCreateSchema, fishUpdateSchema, referenceIdParamsSchema, referenceListQuerySchema } from "../lib/reference-schemas";
import { parseOrSend } from "../lib/validation";
import { createFish, deleteFish, getFish, listFish, updateFish } from "../services/fish-service";

const managerRoles = ["admin"];
const router = Router();

router.get("/", async (req, res, next) => {
    try {
        const query = parseOrSend(referenceListQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listFish(query));
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const data = parseOrSend(fishCreateSchema, req.body, res);
        if (!data) return;
        res.status(201).json({ item: await createFish(data, session.user as SessionUser) });
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const params = parseOrSend(referenceIdParamsSchema, req.params, res);
        if (!params) return;
        const item = await getFish(params.id);
        if (!item) {
            res.status(404).json({ message: "Рыба не найдена" });
            return;
        }
        res.json({ item });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const params = parseOrSend(referenceIdParamsSchema, req.params, res);
        const data = parseOrSend(fishUpdateSchema, req.body, res);
        if (!params || !data) return;
        const item = await updateFish(params.id, data, session.user as SessionUser);
        if (!item) {
            res.status(404).json({ message: "Рыба не найдена" });
            return;
        }
        res.json({ item });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const params = parseOrSend(referenceIdParamsSchema, req.params, res);
        if (!params) return;
        const deleted = await deleteFish(params.id, session.user as SessionUser);
        if (!deleted) {
            res.status(404).json({ message: "Рыба не найдена" });
            return;
        }
        res.json({ deleted });
    } catch (error) {
        next(error);
    }
});

export const fishRouter = router;
