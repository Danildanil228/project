import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { requireAuth, superAdminUserIds, type SessionUser } from "../lib/admin-auth";
import { hasElevatedAccess } from "../lib/admin-roles";
import { createPostSchema, myPostsQuerySchema, postIdParamsSchema } from "../lib/post-schemas";
import { parseOrSend } from "../lib/validation";
import { createPost, deleteOwnPost, getPostById, listMyPosts, submitDraft, updateDraft } from "../services/post-service";

const router = Router();

router.post("/", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const input = parseOrSend(createPostSchema, req.body, res);
        if (!input) return;
        res.status(201).json({ post: await createPost(session.user as SessionUser, input) });
    } catch (error) {
        next(error);
    }
});

router.get("/mine", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const query = parseOrSend(myPostsQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listMyPosts(session.user.id, query));
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const post = await getPostById(params.id);
        if (!post) {
            res.status(404).json({ message: "Пост не найден" });
            return;
        }

        if (post.status !== "approved") {
            const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
            const viewer = session?.user as SessionUser | undefined;
            const isOwner = Boolean(viewer && viewer.id === post.authorId);
            const isElevated = viewer ? hasElevatedAccess(viewer, superAdminUserIds) : false;
            if (!isOwner && !isElevated) {
                res.status(403).json({ message: "Нет доступа к посту" });
                return;
            }
        }

        res.json({ post });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        const input = parseOrSend(createPostSchema, req.body, res);
        if (!params || !input) return;

        const result = await updateDraft(params.id, session.user as SessionUser, input, input.submit);
        if (result.status === "not-found") {
            res.status(404).json({ message: "Пост не найден" });
            return;
        }
        if (result.status === "locked") {
            res.status(409).json({ message: "Пост нельзя редактировать в текущем статусе" });
            return;
        }
        res.json({ post: result.post });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/submit", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;

        const result = await submitDraft(params.id, session.user as SessionUser);
        if (result.status === "not-found") {
            res.status(404).json({ message: "Пост не найден" });
            return;
        }
        if (result.status === "locked") {
            res.status(409).json({ message: "Пост уже на проверке или опубликован" });
            return;
        }
        res.json({ post: result.post });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;

        const result = await deleteOwnPost(params.id, session.user as SessionUser);
        if (result.status === "not-found") {
            res.status(404).json({ message: "Пост не найден" });
            return;
        }
        if (result.status === "locked") {
            res.status(409).json({ message: "Опубликованный пост удаляет модерация" });
            return;
        }
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export const postsRouter = router;
