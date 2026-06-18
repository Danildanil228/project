import { pool } from "../lib/db";
import { superAdminUserIds } from "../lib/admin-auth";
import type { SessionUser } from "../lib/admin-auth";
import { writeAuditLog } from "../lib/audit-log";

export type NotificationType =
    | "comment"
    | "post_approved"
    | "post_rejected"
    | "post_removed"
    | "moderation_new"
    | "report_new";

type CreateNotificationInput = {
    userId: string;
    type: NotificationType;
    postId?: number | null;
    actorId?: string | null;
    data?: Record<string, unknown>;
};

// Best-effort: a failed notification must never break the action that triggered it.
export async function createNotification(input: CreateNotificationInput) {
    try {
        await pool.query(
            `INSERT INTO notification (user_id, type, post_id, actor_id, data) VALUES ($1, $2, $3, $4, $5)`,
            [input.userId, input.type, input.postId ?? null, input.actorId ?? null, JSON.stringify(input.data ?? {})],
        );
    } catch (error) {
        console.warn("Failed to write notification", error);
    }
}

// Fan-out to every moderator / admin / super-admin (except the actor).
export async function notifyModerators(input: Omit<CreateNotificationInput, "userId"> & { excludeUserId?: string }) {
    try {
        const { rows } = await pool.query<{ id: string }>(
            `SELECT id FROM "user" WHERE role ILIKE '%admin%' OR role ILIKE '%moderator%' OR id = ANY($1::text[])`,
            [superAdminUserIds],
        );
        const recipients = rows.map((row) => row.id).filter((id) => id !== input.excludeUserId);
        for (const userId of recipients) {
            await createNotification({ userId, type: input.type, postId: input.postId, actorId: input.actorId, data: input.data });
        }
    } catch (error) {
        console.warn("Failed to notify moderators", error);
    }
}

export async function listNotifications(userId: string, query: { unreadOnly: "true" | "false"; limit: number; offset: number }) {
    const where = [`n.user_id = $1`];
    if (query.unreadOnly === "true") where.push(`n.read_at IS NULL`);
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const { rows } = await pool.query(
        `
            SELECT n.id, n.type, n.post_id AS "postId", n.actor_id AS "actorId", n.data,
                   n.read_at AS "readAt", n.created_at AS "createdAt",
                   a.name AS "actorName"
            FROM notification n
            LEFT JOIN "user" a ON a.id = n.actor_id
            ${whereSql}
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT $2 OFFSET $3
        `,
        [userId, query.limit, query.offset],
    );

    return { items: rows, limit: query.limit, offset: query.offset };
}

export async function countUnread(userId: string) {
    const { rows } = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM notification WHERE user_id = $1 AND read_at IS NULL`,
        [userId],
    );
    return rows[0]?.count ?? 0;
}

// Marks the given ids read, or all of the user's notifications when ids is omitted.
export async function markRead(user: SessionUser, ids?: number[]) {
    let updated = 0;
    if (ids && ids.length) {
        const result = await pool.query(`UPDATE notification SET read_at = NOW() WHERE user_id = $1 AND id = ANY($2::int[]) AND read_at IS NULL`, [user.id, ids]);
        updated = result.rowCount ?? 0;
    } else {
        const result = await pool.query(`UPDATE notification SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [user.id]);
        updated = result.rowCount ?? 0;
    }
    await writeAuditLog({
        actor: user,
        action: ids?.length ? "notification.read" : "notification.read-all",
        targetUserId: user.id,
        metadata: { notificationIds: ids ?? null, updated },
    });
    return { unread: await countUnread(user.id) };
}
