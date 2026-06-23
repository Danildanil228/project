import { Router } from "express";
import { requireRole, type SessionUser } from "../lib/admin-auth";
import { spotCreateSchema, spotIdParamsSchema, spotListQuerySchema, spotUpdateSchema } from "../lib/spot-schemas";
import { parseOrSend } from "../lib/validation";
import { createSpot, deleteSpot, getSpot, listSpots, updateSpot } from "../services/spot-service";

const router = Router();
const managerRoles = ["admin"];

router.get("/", async (req, res, next) => {
    try {
        const query = parseOrSend(spotListQuerySchema, req.query, res);
        if (!query) return;
        if (query.includeInactive && !(await requireRole(req, res, managerRoles))) return;
        res.json({ items: await listSpots(query.waterbodyId, query.includeInactive) });
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const params = parseOrSend(spotIdParamsSchema, req.params, res);
        if (!params) return;
        const item = await getSpot(params.id);
        if (!item) return res.status(404).json({ message: "Точка не найдена" });
        if (!item.isActive && !(await requireRole(req, res, managerRoles))) return;
        res.json({ item });
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const data = parseOrSend(spotCreateSchema, req.body, res);
        if (!data) return;
        res.status(201).json({ item: await createSpot(data, session.user as SessionUser) });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const params = parseOrSend(spotIdParamsSchema, req.params, res);
        const data = parseOrSend(spotUpdateSchema, req.body, res);
        if (!params || !data) return;
        const item = await updateSpot(params.id, data, session.user as SessionUser);
        if (!item) return res.status(404).json({ message: "Точка не найдена" });
        res.json({ item });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const params = parseOrSend(spotIdParamsSchema, req.params, res);
        if (!params) return;
        const deleted = await deleteSpot(params.id, session.user as SessionUser);
        if (!deleted) return res.status(404).json({ message: "Точка не найдена" });
        res.json({ deleted });
    } catch (error) {
        next(error);
    }
});

export const spotsRouter = router;
