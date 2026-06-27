import { pool } from "../lib/db";
import { superAdminUserIds } from "../lib/admin-auth";
import type { SessionUser } from "../lib/admin-auth";
import { writeAuditLog } from "../lib/audit-log";
import { deleteUploadedMedia } from "../lib/uploads";
import { broadcastNotification } from "./notification-realtime";

export type NotificationType =
    | "comment"
    | "post_approved"
    | "post_rejected"
    | "post_removed"
    | "moderation_new"
    | "report_new"
    | "map_submission_new"
    | "map_submission_approved"
    | "map_submission_rejected";

export type NotificationSoundKey = "default" | "soft" | "chime" | "double" | "custom";

export type NotificationSoundSettings = {
    enabled: boolean;
    sound: NotificationSoundKey;
    volume: number;
    customUrl: string | null;
};

const defaultSoundSettings: NotificationSoundSettings = {
    enabled: true,
    sound: "default",
    volume: 0.65,
    customUrl: null,
};

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
        const { rows } = await pool.query<{ id: number }>(
            `INSERT INTO notification (user_id, type, post_id, actor_id, data)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [input.userId, input.type, input.postId ?? null, input.actorId ?? null, JSON.stringify(input.data ?? {})],
        );
        const notificationId = rows[0]?.id;
        if (notificationId !== undefined) await broadcastNotification({ id: notificationId, userId: input.userId });
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

export async function unreadSummary(userId: string) {
    const { rows } = await pool.query<{ unread: number; latestId: number | null }>(
        `SELECT COUNT(*)::int AS unread, MAX(id)::int AS "latestId" FROM notification WHERE user_id = $1 AND read_at IS NULL`,
        [userId],
    );
    return { unread: rows[0]?.unread ?? 0, latestId: rows[0]?.latestId ?? null };
}

export async function countUnread(userId: string) {
    return (await unreadSummary(userId)).unread;
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

export async function getNotificationSoundSettings(userId: string): Promise<NotificationSoundSettings> {
    const { rows } = await pool.query<NotificationSoundSettings>(
        `SELECT enabled, sound, volume::float8 AS volume, "customUrl" FROM "notificationSoundPreference" WHERE "userId" = $1`,
        [userId],
    );
    return rows[0] ?? defaultSoundSettings;
}

export async function updateNotificationSoundSettings(
    user: SessionUser,
    input: Pick<NotificationSoundSettings, "enabled" | "sound" | "volume">,
) {
    const current = await getNotificationSoundSettings(user.id);
    if (input.sound === "custom" && !current.customUrl) return { status: "missing-custom" as const };

    const { rows } = await pool.query<NotificationSoundSettings>(
        `
            INSERT INTO "notificationSoundPreference" ("userId", enabled, sound, volume, "customUrl")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ("userId") DO UPDATE SET
                enabled = EXCLUDED.enabled,
                sound = EXCLUDED.sound,
                volume = EXCLUDED.volume,
                "updatedAt" = NOW()
            RETURNING enabled, sound, volume::float8 AS volume, "customUrl"
        `,
        [user.id, input.enabled, input.sound, input.volume, current.customUrl],
    );
    await writeAuditLog({
        actor: user,
        action: "notification.sound.update",
        targetUserId: user.id,
        metadata: { enabled: input.enabled, sound: input.sound, volume: input.volume },
    });
    return { status: "ok" as const, settings: rows[0] };
}

export async function setCustomNotificationSound(user: SessionUser, url: string) {
    const current = await getNotificationSoundSettings(user.id);
    const { rows } = await pool.query<NotificationSoundSettings>(
        `
            INSERT INTO "notificationSoundPreference" ("userId", enabled, sound, volume, "customUrl")
            VALUES ($1, TRUE, 'custom', $2, $3)
            ON CONFLICT ("userId") DO UPDATE SET
                enabled = TRUE,
                sound = 'custom',
                "customUrl" = EXCLUDED."customUrl",
                "updatedAt" = NOW()
            RETURNING enabled, sound, volume::float8 AS volume, "customUrl"
        `,
        [user.id, current.volume, url],
    );
    if (current.customUrl && current.customUrl !== url) await deleteUploadedMedia(current.customUrl);
    await writeAuditLog({
        actor: user,
        action: "notification.sound.upload",
        targetUserId: user.id,
        metadata: { url },
    });
    return rows[0];
}

export async function removeCustomNotificationSound(user: SessionUser) {
    const current = await getNotificationSoundSettings(user.id);
    const { rows } = await pool.query<NotificationSoundSettings>(
        `
            INSERT INTO "notificationSoundPreference" ("userId", enabled, sound, volume, "customUrl")
            VALUES ($1, TRUE, 'default', $2, NULL)
            ON CONFLICT ("userId") DO UPDATE SET
                sound = CASE WHEN "notificationSoundPreference".sound = 'custom' THEN 'default' ELSE "notificationSoundPreference".sound END,
                "customUrl" = NULL,
                "updatedAt" = NOW()
            RETURNING enabled, sound, volume::float8 AS volume, "customUrl"
        `,
        [user.id, current.volume],
    );
    if (current.customUrl) await deleteUploadedMedia(current.customUrl);
    await writeAuditLog({ actor: user, action: "notification.sound.delete", targetUserId: user.id });
    return rows[0];
}
