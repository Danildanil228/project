import { Router } from "express";
import { requireRole, type SessionUser } from "../lib/admin-auth";
import { itemCreateSchemas, itemUpdateSchemas } from "../lib/item-schemas";
import { itemIdParamsSchema, itemListQuerySchema, parseOrSend } from "../lib/validation";
import { createItem, deleteItem, getItem, listItems, updateItem, type ItemType } from "../services/items-service";

const itemManagerRoles = ["admin", "moderator"];

export function createItemsRouter(type: ItemType): Router {
    const router = Router();

    router.get("/", async (req, res, next) => {
        try {
            const query = parseOrSend(itemListQuerySchema, req.query, res);
            if (!query) return;

            res.json(await listItems(type, query));
        } catch (error) {
            next(error);
        }
    });

    router.post("/", async (req, res, next) => {
        try {
            const session = await requireRole(req, res, itemManagerRoles);
            if (!session) return;

            const data = parseOrSend(itemCreateSchemas[type], req.body, res);
            if (!data) return;

            const item = await createItem(type, data as Record<string, unknown>, session.user as SessionUser);
            res.status(201).json({ item });
        } catch (error) {
            next(error);
        }
    });

    router.get("/:id", async (req, res, next) => {
        try {
            const params = parseOrSend(itemIdParamsSchema, req.params, res);
            if (!params) return;

            const item = await getItem(type, params.id);
            if (!item) {
                res.status(404).json({ message: "Item not found" });
                return;
            }

            res.json({ item });
        } catch (error) {
            next(error);
        }
    });

    router.patch("/:id", async (req, res, next) => {
        try {
            const session = await requireRole(req, res, itemManagerRoles);
            if (!session) return;

            const params = parseOrSend(itemIdParamsSchema, req.params, res);
            const data = parseOrSend(itemUpdateSchemas[type], req.body, res);
            if (!params || !data) return;

            const item = await updateItem(type, params.id, data as Record<string, unknown>, session.user as SessionUser);
            if (!item) {
                res.status(404).json({ message: "Item not found" });
                return;
            }

            res.json({ item });
        } catch (error) {
            next(error);
        }
    });

    router.delete("/:id", async (req, res, next) => {
        try {
            const session = await requireRole(req, res, itemManagerRoles);
            if (!session) return;

            const params = parseOrSend(itemIdParamsSchema, req.params, res);
            if (!params) return;

            const deleted = await deleteItem(type, params.id, session.user as SessionUser);
            if (!deleted) {
                res.status(404).json({ message: "Item not found" });
                return;
            }

            res.json({ deleted });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
