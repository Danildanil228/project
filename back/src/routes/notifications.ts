import { Router } from "express";
import { requireAuth } from "../lib/admin-auth";
import { parseOrSend } from "../lib/validation";
import { markReadSchema, notificationQuerySchema } from "../lib/engagement-schemas";
import { countUnread, listNotifications, markRead } from "../services/notification-service";

const router = Router();

router.get("/", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const query = parseOrSend(notificationQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listNotifications(session.user.id, query));
    } catch (error) {
        next(error);
    }
});

router.get("/unread-count", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        res.json({ unread: await countUnread(session.user.id) });
    } catch (error) {
        next(error);
    }
});

router.post("/read", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const body = parseOrSend(markReadSchema, req.body ?? {}, res);
        if (!body) return;
        res.json(await markRead(session.user.id, body.ids));
    } catch (error) {
        next(error);
    }
});

export const notificationsRouter = router;
