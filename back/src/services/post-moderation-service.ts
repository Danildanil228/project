import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import type { moderationQueueQuerySchema, postContentSchema } from "../lib/post-schemas";
import { getPostById, insertVersionChildren } from "./post-service";

type QueueQuery = z.infer<typeof moderationQueueQuerySchema>;
type PostContent = z.infer<typeof postContentSchema>;

// A claim older than this is considered abandoned and can be taken over / auto-released.
const CLAIM_TIMEOUT_MINUTES = 20;

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
    const result = await pool.query(
        `
            UPDATE post SET status = 'approved', published_at = NOW(), claimed_by = NULL, claimed_at = NULL, rejection_reason = NULL, updated_at = NOW()
            WHERE id = $1 AND status IN ('pending', 'in_review')
            RETURNING id
        `,
        [postId],
    );
    if (!result.rowCount) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: "post.approve", metadata: { postId } });
    return { status: "ok" as const, post: await getPostById(postId) };
}

export async function rejectPost(postId: number, moderator: SessionUser, reason: string) {
    const result = await pool.query(
        `
            UPDATE post SET status = 'rejected', rejection_reason = $2, claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
            WHERE id = $1 AND status IN ('pending', 'in_review')
            RETURNING id
        `,
        [postId, reason],
    );
    if (!result.rowCount) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: "post.reject", metadata: { postId, reason } });
    return { status: "ok" as const };
}

export async function removePost(postId: number, moderator: SessionUser) {
    const result = await pool.query(
        `UPDATE post SET status = 'deleted', claimed_by = NULL, claimed_at = NULL, updated_at = NOW() WHERE id = $1 AND status <> 'deleted' RETURNING id`,
        [postId],
    );
    if (!result.rowCount) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: "post.remove", metadata: { postId } });
    return { status: "ok" as const };
}

// Moderator edits the post's current version in place; republishes (new date) when already approved.
export async function moderatorUpdateContent(postId: number, moderator: SessionUser, content: PostContent) {
    const owned = await pool.query(`SELECT status, current_version_id AS "versionId" FROM post WHERE id = $1`, [postId]);
    if (!owned.rows[0] || !owned.rows[0].versionId) return { status: "not-found" as const };
    if (owned.rows[0].status === "deleted") return { status: "invalid" as const };

    const versionId = owned.rows[0].versionId as number;
    const isApproved = owned.rows[0].status === "approved";
    const previousMedia = await pool.query<{ url: string }>(`SELECT url FROM post_media WHERE post_version_id = $1`, [versionId]);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
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
    for (const row of previousMedia.rows) {
        if (!keep.has(row.url)) await deleteUploadedMedia(row.url);
    }

    await writeAuditLog({ actor: moderator, action: "post.moderate-edit", metadata: { postId } });
    return { status: "ok" as const, post: await getPostById(postId) };
}
