import { Router } from "express";
import { requireRole, type SessionUser } from "../lib/admin-auth";
import { baitCreateSchema, baitIdParamsSchema, baitListQuerySchema, baitUpdateSchema } from "../lib/bait-schemas";
import { parseOrSend } from "../lib/validation";
import { createBait, deleteBait, getBait, getBaitCatalogMeta, listBaits, updateBait } from "../services/bait-service";

const managerRoles = ["admin"];
const router = Router();

router.get("/", async (req, res, next) => {
    try {
        const query = parseOrSend(baitListQuerySchema, req.query, res);
        if (!query) return;
        if (query.includeInactive && !(await requireRole(req, res, managerRoles))) return;
        res.json(await listBaits(query));
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const data = parseOrSend(baitCreateSchema, req.body, res);
        if (!data) return;
        res.status(201).json({ item: await createBait(data, session.user as SessionUser) });
    } catch (error) {
        next(error);
    }
});

router.get("/meta", async (_req, res, next) => {
    try {
        res.json(await getBaitCatalogMeta());
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const params = parseOrSend(baitIdParamsSchema, req.params, res);
        if (!params) return;
        const item = await getBait(params.id);
        if (!item || !item.isActive) {
            res.status(404).json({ message: "Наживка не найдена" });
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
        const params = parseOrSend(baitIdParamsSchema, req.params, res);
        const data = parseOrSend(baitUpdateSchema, req.body, res);
        if (!params || !data) return;
        const item = await updateBait(params.id, data, session.user as SessionUser);
        if (!item) {
            res.status(404).json({ message: "Наживка не найдена" });
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
        const params = parseOrSend(baitIdParamsSchema, req.params, res);
        if (!params) return;
        const deleted = await deleteBait(params.id, session.user as SessionUser);
        if (!deleted) {
            res.status(404).json({ message: "Наживка не найдена" });
            return;
        }
        res.json({ deleted });
    } catch (error) {
        next(error);
    }
});

export const baitsRouter = router;
