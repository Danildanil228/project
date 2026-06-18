import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import type { moderationQueueQuerySchema, postContentSchema } from "../lib/post-schemas";
import { assertSubmittable, getPostById, insertVersionChildren } from "./post-service";
import { createNotification } from "./notification-service";

type QueueQuery = z.infer<typeof moderationQueueQuerySchema>;
type PostContent = z.infer<typeof postContentSchema>;

// A claim older than this is considered abandoned and can be taken over / auto-released.
const CLAIM_TIMEOUT_MINUTES = 20;

// Hard cap on simultaneously pinned posts. Keeps the "featured" tier curated rather than overflowing.
export const PIN_LIMIT = 3;

export async function listModerationQueue(query: QueueQuery) {
    const where: string[] = [`p.status IN ('pending', 'in_review')`];
    const values: unknown[] = [];
    if (query.status) {
        values.push(query.status);
        where.push(`p.status = $${values.length}`);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM post p ${whereSql}`, values);
    values.push(query.limit, query.offset);

    const { rows } = await pool.query(
        `
            SELECT p.id, p.status, p.claimed_by AS "claimedById", cu.name AS "claimedByName",
                   p.claimed_at AS "claimedAt", p.created_at AS "createdAt", p.updated_at AS "updatedAt",
                   p.resubmit_count AS "resubmitCount",
                   (p.claimed_at IS NOT NULL AND p.claimed_at < NOW() - INTERVAL '${CLAIM_TIMEOUT_MINUTES} minutes') AS "claimExpired",
                   u.id AS "authorId", u.name AS "authorName",
                   pv.description, pv.fishing_method AS "fishingMethod", w.name AS "waterbodyName",
                   (SELECT url FROM post_media WHERE post_version_id = pv.id ORDER BY order_index, id LIMIT 1) AS "coverUrl",
                   (SELECT COUNT(*)::int FROM catch WHERE post_version_id = pv.id) AS "catchCount"
            FROM post p
            JOIN "user" u ON u.id = p.author_id
            LEFT JOIN "user" cu ON cu.id = p.claimed_by
            LEFT JOIN post_version pv ON pv.id = p.current_version_id
            LEFT JOIN waterbody w ON w.id = pv.waterbody_id
            ${whereSql}
            ORDER BY p.updated_at ASC, p.id ASC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return { items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function claimPost(postId: number, moderator: SessionUser) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `SELECT status, claimed_by AS "claimedBy", EXTRACT(EPOCH FROM (NOW() - claimed_at)) / 60 AS "ageMinutes" FROM post WHERE id = $1 FOR UPDATE`,
            [postId],
        );
        if (!result.rows[0]) {
            await client.query("ROLLBACK");
            return { status: "not-found" as const };
        }

        const post = result.rows[0];
        if (post.status !== "pending" && post.status !== "in_review") {
            await client.query("ROLLBACK");
            return { status: "invalid" as const };
        }
        const claimFresh = post.ageMinutes !== null && Number(post.ageMinutes) < CLAIM_TIMEOUT_MINUTES;
        if (post.status === "in_review" && post.claimedBy && post.claimedBy !== moderator.id && claimFresh) {
            await client.query("ROLLBACK");
            return { status: "taken" as const, claimedBy: post.claimedBy };
        }

        await client.query(`UPDATE post SET status = 'in_review', claimed_by = $2, claimed_at = NOW(), updated_at = NOW() WHERE id = $1`, [postId, moderator.id]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }

    await writeAuditLog({ actor: moderator, action: "post.claim", metadata: { postId } });
    return { status: "ok" as const, post: await getPostById(postId) };
}

export async function releasePost(postId: number, moderator: SessionUser) {
    const result = await pool.query(
        `
            UPDATE post SET status = 'pending', claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
            WHERE id = $1 AND status = 'in_review' AND (claimed_by = $2 OR claimed_at < NOW() - INTERVAL '${CLAIM_TIMEOUT_MINUTES} minutes')
            RETURNING id
        `,
        [postId, moderator.id],
    );
    if (!result.rowCount) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: "post.release", metadata: { postId } });
    return { status: "ok" as const };
}

export async function approvePost(postId: number, moderator: SessionUser) {
    const result = await pool.query<{ authorId: string }>(
        `
            UPDATE post SET status = 'approved', published_at = NOW(), claimed_by = NULL, claimed_at = NULL, rejection_reason = NULL, updated_at = NOW()
            WHERE id = $1
              AND status = 'in_review'
              AND claimed_by = $2
              AND claimed_at >= NOW() - INTERVAL '${CLAIM_TIMEOUT_MINUTES} minutes'
            RETURNING author_id AS "authorId"
        `,
        [postId, moderator.id],
    );
    if (!result.rowCount) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: "post.approve", metadata: { postId } });
    await createNotification({ userId: result.rows[0].authorId, type: "post_approved", postId, actorId: moderator.id });
    return { status: "ok" as const, post: await getPostById(postId) };
}

export async function rejectPost(postId: number, moderator: SessionUser, reason: string) {
    const result = await pool.query<{ authorId: string }>(
        `
            UPDATE post SET status = 'rejected', rejection_reason = $2, claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
            WHERE id = $1
              AND status = 'in_review'
              AND claimed_by = $3
              AND claimed_at >= NOW() - INTERVAL '${CLAIM_TIMEOUT_MINUTES} minutes'
            RETURNING author_id AS "authorId"
        `,
        [postId, reason, moderator.id],
    );
    if (!result.rowCount) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: "post.reject", metadata: { postId, reason } });
    await createNotification({ userId: result.rows[0].authorId, type: "post_rejected", postId, actorId: moderator.id, data: { reason } });
    return { status: "ok" as const };
}

export async function removePost(postId: number, moderator: SessionUser) {
    const result = await pool.query<{ authorId: string }>(
        `UPDATE post SET status = 'deleted', claimed_by = NULL, claimed_at = NULL, updated_at = NOW() WHERE id = $1 AND status <> 'deleted' RETURNING author_id AS "authorId"`,
        [postId],
    );
    if (!result.rowCount) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: "post.remove", metadata: { postId } });
    await createNotification({ userId: result.rows[0].authorId, type: "post_removed", postId, actorId: moderator.id });
    return { status: "ok" as const };
}

export async function pinPost(postId: number, moderator: SessionUser) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Serialize pin operations so concurrent requests cannot exceed the global limit.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('post-pin-limit'))`);
        const target = await client.query<{ status: string; pinnedAt: string | null }>(
            `SELECT status, pinned_at AS "pinnedAt" FROM post WHERE id = $1 FOR UPDATE`,
            [postId],
        );
        if (!target.rows[0]) {
            await client.query("ROLLBACK");
            return { status: "not-found" as const };
        }
        if (target.rows[0].status !== "approved") {
            await client.query("ROLLBACK");
            return { status: "invalid" as const };
        }
        if (target.rows[0].pinnedAt) {
            await client.query("COMMIT");
            return { status: "ok" as const };
        }

        const { rows: countRows } = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM post WHERE pinned_at IS NOT NULL`);
        if ((countRows[0]?.count ?? 0) >= PIN_LIMIT) {
            await client.query("ROLLBACK");
            return { status: "limit" as const, limit: PIN_LIMIT };
        }

        await client.query(`UPDATE post SET pinned_at = NOW() WHERE id = $1`, [postId]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
    await writeAuditLog({ actor: moderator, action: "post.pin", metadata: { postId } });
    return { status: "ok" as const };
}

export async function unpinPost(postId: number, moderator: SessionUser) {
    const { rowCount } = await pool.query(`UPDATE post SET pinned_at = NULL WHERE id = $1 AND pinned_at IS NOT NULL RETURNING id`, [postId]);
    if (!rowCount) return { status: "not-pinned" as const };
    await writeAuditLog({ actor: moderator, action: "post.unpin", metadata: { postId } });
    return { status: "ok" as const };
}

// Moderator edits the post's current version in place; republishes (new date) when already approved.
export async function moderatorUpdateContent(postId: number, moderator: SessionUser, content: PostContent) {
    assertSubmittable(content);

    const client = await pool.connect();
    let previousMedia: { url: string }[] = [];
    try {
        await client.query("BEGIN");
        const owned = await client.query<{
            status: string;
            versionId: number | null;
            claimedBy: string | null;
            claimFresh: boolean;
        }>(
            `
                SELECT status, current_version_id AS "versionId", claimed_by AS "claimedBy",
                       (claimed_at >= NOW() - INTERVAL '${CLAIM_TIMEOUT_MINUTES} minutes') AS "claimFresh"
                FROM post WHERE id = $1 FOR UPDATE
            `,
            [postId],
        );
        const post = owned.rows[0];
        if (!post || !post.versionId) {
            await client.query("ROLLBACK");
            return { status: "not-found" as const };
        }
        if (post.status !== "approved" && post.status !== "in_review") {
            await client.query("ROLLBACK");
            return { status: "invalid" as const };
        }
        if (post.status === "in_review" && (post.claimedBy !== moderator.id || !post.claimFresh)) {
            await client.query("ROLLBACK");
            return { status: "invalid" as const };
        }

        const versionId = post.versionId;
        const isApproved = post.status === "approved";
        const mediaResult = await client.query<{ url: string }>(`SELECT url FROM post_media WHERE post_version_id = $1`, [versionId]);
        previousMedia = mediaResult.rows;
        await client.query(
            `UPDATE post_version SET description = $1, waterbody_id = $2, point = $3, fishing_method = $4, income = $5, fishing_minutes = $6 WHERE id = $7`,
            [content.description, content.waterbodyId, content.point, content.fishingMethod, content.income, content.fishingMinutes, versionId],
        );
        await client.query(`DELETE FROM catch WHERE post_version_id = $1`, [versionId]);
        await client.query(`DELETE FROM post_media WHERE post_version_id = $1`, [versionId]);
        await insertVersionChildren(client, versionId, content);
        await client.query(`UPDATE post SET updated_at = NOW()${isApproved ? ", published_at = NOW()" : ""} WHERE id = $1`, [postId]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }

    const keep = new Set(content.media);
    for (const row of previousMedia) {
        if (!keep.has(row.url)) await deleteUploadedMedia(row.url);
    }

    await writeAuditLog({ actor: moderator, action: "post.moderate-edit", metadata: { postId } });
    return { status: "ok" as const, post: await getPostById(postId) };
}
