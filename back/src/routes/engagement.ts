import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { requireAuth, type SessionUser } from "../lib/admin-auth";
import { parseOrSend } from "../lib/validation";
import { postIdParamsSchema } from "../lib/post-schemas";
import {
    commentBodySchema,
    commentIdParamsSchema,
    paginationQuerySchema,
    reactionBodySchema,
    reportBodySchema,
} from "../lib/engagement-schemas";
import { createComment, deleteComment, listComments } from "../services/comment-service";
import { getReactionSummary, setReaction } from "../services/reaction-service";
import { createReport } from "../services/report-service";

const router = Router();

// Comments
router.get("/:id/comments", async (req, res, next) => {
    try {
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        const query = parseOrSend(paginationQuerySchema, req.query, res);
        if (!params || !query) return;
        const result = await listComments(params.id, query);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.post("/:id/comments", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        const body = parseOrSend(commentBodySchema, req.body, res);
        if (!params || !body) return;
        const result = await createComment(params.id, session.user as SessionUser, body.body);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        if (result.status === "invalid") return void res.status(409).json({ message: "Комментировать можно только опубликованные посты" });
        res.status(201).json({ comment: result.comment });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id/comments/:commentId", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const params = parseOrSend(commentIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await deleteComment(params.id, params.commentId, session.user as SessionUser);
        if (result.status === "not-found") return void res.status(404).json({ message: "Комментарий не найден" });
        if (result.status === "forbidden") return void res.status(403).json({ message: "Нет прав на удаление" });
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

// Reactions
router.get("/:id/reactions", async (req, res, next) => {
    try {
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        res.json(await getReactionSummary(params.id, session?.user?.id));
    } catch (error) {
        next(error);
    }
});

router.post("/:id/reactions", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        const body = parseOrSend(reactionBodySchema, req.body, res);
        if (!params || !body) return;
        const result = await setReaction(params.id, session.user as SessionUser, body.value);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        if (result.status === "invalid") return void res.status(409).json({ message: "Реакции доступны только для опубликованных постов" });
        res.json({ summary: result.summary });
    } catch (error) {
        next(error);
    }
});

// Report a post
router.post("/:id/reports", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        const body = parseOrSend(reportBodySchema, req.body, res);
        if (!params || !body) return;
        const result = await createReport(params.id, session.user as SessionUser, body.reason);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        if (result.status === "invalid") return void res.status(409).json({ message: "Жаловаться можно только на опубликованные посты" });
        if (result.status === "duplicate") return void res.status(409).json({ message: "Вы уже отправляли жалобу на этот пост" });
        res.status(201).json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export const engagementRouter = router;
