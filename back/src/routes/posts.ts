import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { pool } from "../lib/db";
import { requireAuth, requireRole, superAdminUserIds, type SessionUser } from "../lib/admin-auth";
import { hasElevatedAccess } from "../lib/admin-roles";
import {
    authorIdParamsSchema,
    createPostSchema,
    feedQuerySchema,
    moderationQueueQuerySchema,
    myPostsQuerySchema,
    paginationQuerySchema,
    postContentSchema,
    postIdParamsSchema,
    rejectSchema,
} from "../lib/post-schemas";
import { parseOrSend } from "../lib/validation";
import { createPost, deleteOwnPost, getAuthorProfile, getPostById, incrementViewCount, listFeed, listMyPosts, submitDraft, updateDraft } from "../services/post-service";
import { approvePost, claimPost, listModerationQueue, moderatorUpdateContent, PIN_LIMIT, pinPost, rejectPost, releasePost, removePost, unpinPost } from "../services/post-moderation-service";

const moderatorRoles = ["admin", "moderator"];

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

router.get("/feed", async (req, res, next) => {
    try {
        const query = parseOrSend(feedQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listFeed(query));
    } catch (error) {
        next(error);
    }
});

router.get("/author/:authorId", async (req, res, next) => {
    try {
        const params = parseOrSend(authorIdParamsSchema, req.params, res);
        const query = parseOrSend(paginationQuerySchema, req.query, res);
        if (!params || !query) return;
        const profile = await getAuthorProfile(params.authorId, query);
        if (!profile) {
            res.status(404).json({ message: "Автор не найден" });
            return;
        }
        res.json(profile);
    } catch (error) {
        next(error);
    }
});

// Per-session view counting: the frontend hits this once per session (uses sessionStorage to dedupe locally).
router.post("/:id/view", async (req, res, next) => {
    try {
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await incrementViewCount(params.id);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        res.json({ ok: true });
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

router.get("/moderation/queue", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const query = parseOrSend(moderationQueueQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listModerationQueue(query));
    } catch (error) {
        next(error);
    }
});

router.post("/:id/claim", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await claimPost(params.id, session.user as SessionUser);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        if (result.status === "invalid") return void res.status(409).json({ message: "Пост нельзя взять в модерацию" });
        if (result.status === "taken") return void res.status(409).json({ message: "Пост уже взят другим модератором" });
        res.json({ post: result.post });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/release", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await releasePost(params.id, session.user as SessionUser);
        if (result.status === "invalid") return void res.status(409).json({ message: "Нельзя отложить этот пост" });
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/approve", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await approvePost(params.id, session.user as SessionUser);
        if (result.status === "invalid") return void res.status(409).json({ message: "Пост нельзя одобрить в текущем статусе" });
        res.json({ post: result.post });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/reject", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        const body = parseOrSend(rejectSchema, req.body, res);
        if (!params || !body) return;
        const result = await rejectPost(params.id, session.user as SessionUser, body.reason);
        if (result.status === "invalid") return void res.status(409).json({ message: "Пост нельзя отклонить в текущем статусе" });
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id/moderate", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        const content = parseOrSend(postContentSchema, req.body, res);
        if (!params || !content) return;
        const result = await moderatorUpdateContent(params.id, session.user as SessionUser, content);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        if (result.status === "invalid") return void res.status(409).json({ message: "Пост нельзя редактировать" });
        res.json({ post: result.post });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/pin", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await pinPost(params.id, session.user as SessionUser);
        if (result.status === "not-found") return void res.status(404).json({ message: "Пост не найден" });
        if (result.status === "invalid") return void res.status(409).json({ message: "Закрепить можно только опубликованный пост" });
        if (result.status === "limit") return void res.status(409).json({ message: `Достигнут лимит закреплённых постов (${result.limit}). Открепите другой, чтобы закрепить этот.` });
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id/pin", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await unpinPost(params.id, session.user as SessionUser);
        if (result.status === "not-pinned") return void res.status(404).json({ message: "Пост не был закреплён" });
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

router.get("/moderation/pin-info", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        // Tells the frontend how many pinned slots are currently used + the cap, so the star UI can show "2/3".
        const { rows } = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM post WHERE pinned_at IS NOT NULL`);
        res.json({ used: rows[0]?.count ?? 0, limit: PIN_LIMIT });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/remove", async (req, res, next) => {
    try {
        const session = await requireRole(req, res, moderatorRoles);
        if (!session) return;
        const params = parseOrSend(postIdParamsSchema, req.params, res);
        if (!params) return;
        const result = await removePost(params.id, session.user as SessionUser);
        if (result.status === "invalid") return void res.status(409).json({ message: "Пост уже удалён" });
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

export const postsRouter = router;
