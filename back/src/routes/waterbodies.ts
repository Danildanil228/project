import { Router } from "express";
import { requireRole, type SessionUser } from "../lib/admin-auth";
import { referenceIdParamsSchema, referenceListQuerySchema, waterbodyCreateSchema, waterbodyUpdateSchema } from "../lib/reference-schemas";
import { parseOrSend } from "../lib/validation";
import { createWaterbody, deleteWaterbody, getWaterbody, listWaterbodies, updateWaterbody } from "../services/waterbody-service";

const managerRoles = ["admin"];
const router = Router();

router.get("/", async (req, res, next) => {
    try {
        const query = parseOrSend(referenceListQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listWaterbodies(query));
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, managerRoles);
        if (!session) return;
        const data = parseOrSend(waterbodyCreateSchema, req.body, res);
        if (!data) return;
        res.status(201).json({ item: await createWaterbody(data, session.user as SessionUser) });
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const params = parseOrSend(referenceIdParamsSchema, req.params, res);
        if (!params) return;
        const item = await getWaterbody(params.id);
        if (!item) {
            res.status(404).json({ message: "Водоём не найден" });
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
        const data = parseOrSend(waterbodyUpdateSchema, req.body, res);
        if (!params || !data) return;
        const item = await updateWaterbody(params.id, data, session.user as SessionUser);
        if (!item) {
            res.status(404).json({ message: "Водоём не найден" });
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
        const deleted = await deleteWaterbody(params.id, session.user as SessionUser);
        if (!deleted) {
            res.status(404).json({ message: "Водоём не найден" });
            return;
        }
        res.json({ deleted });
    } catch (error) {
        next(error);
    }
});

export const waterbodiesRouter = router;
