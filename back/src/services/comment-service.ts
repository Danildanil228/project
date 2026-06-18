import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import { superAdminUserIds, type SessionUser } from "../lib/admin-auth";
import { hasElevatedAccess } from "../lib/admin-roles";
import { createNotification } from "./notification-service";

async function getPostMeta(postId: number) {
    const { rows } = await pool.query<{ authorId: string; status: string }>(
        `SELECT author_id AS "authorId", status FROM post WHERE id = $1`,
        [postId],
    );
    return rows[0] ?? null;
}

export async function listComments(postId: number, query: { limit: number; offset: number }) {
    const post = await getPostMeta(postId);
    if (!post || post.status !== "approved") return { status: "not-found" as const };

    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM comment WHERE post_id = $1`, [postId]);
    const { rows } = await pool.query(
        `
            SELECT c.id, c.body, c.created_at AS "createdAt",
                   u.id AS "authorId", u.name AS "authorName", u.image AS "authorImage"
            FROM comment c
            JOIN "user" u ON u.id = c.author_id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC, c.id ASC
            LIMIT $2 OFFSET $3
        `,
        [postId, query.limit, query.offset],
    );
    return { status: "ok" as const, items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function createComment(postId: number, author: SessionUser, body: string) {
    const post = await getPostMeta(postId);
    if (!post) return { status: "not-found" as const };
    if (post.status !== "approved") return { status: "invalid" as const };

    const { rows } = await pool.query(
        `INSERT INTO comment (post_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at AS "createdAt"`,
        [postId, author.id, body],
    );
    const created = rows[0];

    await writeAuditLog({ actor: author, action: "comment.create", metadata: { postId, commentId: created.id } });

    // Notify the post author about the new comment (never self-notify).
    if (post.authorId !== author.id) {
        await createNotification({
            userId: post.authorId,
            type: "comment",
            postId,
            actorId: author.id,
            data: { snippet: body.slice(0, 120) },
        });
    }

    return {
        status: "ok" as const,
        comment: {
            id: created.id,
            body: created.body,
            createdAt: created.createdAt,
            authorId: author.id,
            authorName: author.name ?? null,
            authorImage: null,
        },
    };
}

export async function deleteComment(postId: number, commentId: number, actor: SessionUser) {
    const { rows } = await pool.query<{ authorId: string }>(
        `SELECT author_id AS "authorId" FROM comment WHERE id = $1 AND post_id = $2`,
        [commentId, postId],
    );
    if (!rows[0]) return { status: "not-found" as const };

    const isOwner = rows[0].authorId === actor.id;
    const isModerator = hasElevatedAccess(actor, superAdminUserIds);
    if (!isOwner && !isModerator) return { status: "forbidden" as const };

    await pool.query(`DELETE FROM comment WHERE id = $1`, [commentId]);
    await writeAuditLog({ actor, action: isOwner ? "comment.delete-own" : "comment.delete-moderate", metadata: { postId, commentId } });
    return { status: "ok" as const };
}
