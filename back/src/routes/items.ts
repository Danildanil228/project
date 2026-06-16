import { Router } from "express";
import { itemIdParamsSchema, itemListQuerySchema, parseOrSend } from "../lib/validation";
import { getItem, listItems, type ItemType } from "../services/items-service";

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

    return router;
}
