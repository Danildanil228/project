import type { PoolClient } from "pg";
import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import { superAdminUserIds, type SessionUser } from "../lib/admin-auth";
import { hasElevatedAccess } from "../lib/admin-roles";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import {
    incomePerHour,
    type createPostSchema,
    type feedQuerySchema,
    type myPostsQuerySchema,
    type paginationQuerySchema,
    type postContentSchema,
} from "../lib/post-schemas";

type PostContent = z.infer<typeof postContentSchema>;
type CreatePostInput = z.infer<typeof createPostSchema>;
type MyPostsQuery = z.infer<typeof myPostsQuerySchema>;

const editableStatuses = new Set(["draft", "rejected"]);

function assertSubmittable(content: PostContent) {
    const problems: string[] = [];
    if (!content.waterbodyId) problems.push("укажите водоём");
    if (!content.fishingMethod) problems.push("укажите вид ловли");
    if (content.catches.length === 0) problems.push("добавьте хотя бы одну рыбу");
    if (problems.length) {
        throw Object.assign(new Error(`Не удалось отправить пост: ${problems.join(", ")}`), { statusCode: 400 });
    }
}

export async function insertVersionChildren(client: PoolClient, versionId: number, content: PostContent) {
    for (const item of content.catches) {
        await client.query(
            `INSERT INTO catch (post_version_id, fish_id, weight, quantity) VALUES ($1, $2, $3, $4)`,
            [versionId, item.fishId, item.weight, item.quantity],
        );
    }
    for (let index = 0; index < content.media.length; index += 1) {
        await client.query(
            `INSERT INTO post_media (post_version_id, url, order_index) VALUES ($1, $2, $3)`,
            [versionId, content.media[index], index],
        );
    }
}

export async function createPost(author: SessionUser, input: CreatePostInput) {
    if (input.submit) assertSubmittable(input);

    const publishDirectly = input.submit && input.skipModeration && hasElevatedAccess(author, superAdminUserIds);
    const status = input.submit ? (publishDirectly ? "approved" : "pending") : "draft";

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const postResult = await client.query(
            `INSERT INTO post (author_id, status, published_at) VALUES ($1, $2, $3) RETURNING id`,
            [author.id, status, publishDirectly ? new Date() : null],
        );
        const postId = postResult.rows[0].id;

        const versionResult = await client.query(
            `INSERT INTO post_version (post_id, version_number, description, waterbody_id, point, fishing_method, income, fishing_minutes)
             VALUES ($1, 1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [postId, input.description, input.waterbodyId, input.point, input.fishingMethod, input.income, input.fishingMinutes],
        );
        const versionId = versionResult.rows[0].id;

        await insertVersionChildren(client, versionId, input);
        await client.query(`UPDATE post SET current_version_id = $1 WHERE id = $2`, [versionId, postId]);
        await client.query("COMMIT");

        await writeAuditLog({
            actor: author,
            action: publishDirectly ? "post.publish-direct" : input.submit ? "post.submit" : "post.create-draft",
            targetUserId: author.id,
            metadata: { postId },
        });
        return getPostById(postId);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }
}

// Edits a draft/rejected post in place (same version): updates fields, replaces catches and media.
export async function updateDraft(postId: number, author: SessionUser, content: PostContent, submit: boolean) {
    const owned = await pool.query(`SELECT status, current_version_id AS "versionId" FROM post WHERE id = $1 AND author_id = $2`, [postId, author.id]);
    if (!owned.rows[0]) return { status: "not-found" as const };
    if (!editableStatuses.has(owned.rows[0].status)) {
        return { status: "locked" as const };
    }
    if (submit) assertSubmittable(content);

    const versionId = owned.rows[0].versionId as number;
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
        await client.query(`UPDATE post SET status = $1, updated_at = NOW() WHERE id = $2`, [submit ? "pending" : "draft", postId]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        translateDbError(error);
    } finally {
        client.release();
    }

    // Clean up image files that were dropped from the post.
    const keep = new Set(content.media);
    for (const row of previousMedia.rows) {
        if (!keep.has(row.url)) await deleteUploadedMedia(row.url);
    }

    await writeAuditLog({ actor: author, action: submit ? "post.submit" : "post.update-draft", targetUserId: author.id, metadata: { postId } });
    return { status: "ok" as const, post: await getPostById(postId) };
}

export async function submitDraft(postId: number, author: SessionUser) {
    const owned = await pool.query(`SELECT status FROM post WHERE id = $1 AND author_id = $2`, [postId, author.id]);
    if (!owned.rows[0]) return { status: "not-found" as const };
    if (!editableStatuses.has(owned.rows[0].status)) return { status: "locked" as const };

    const full = await getPostById(postId);
    if (full?.version) {
        assertSubmittable({
            description: full.version.description ?? "",
            waterbodyId: full.version.waterbodyId,
            point: full.version.point,
            fishingMethod: full.version.fishingMethod,
            income: full.version.income,
            fishingMinutes: full.version.fishingMinutes,
            catches: full.version.catches.map((item: { fishId: number; weight: number | null; quantity: number }) => ({
                fishId: item.fishId,
                weight: item.weight,
                quantity: item.quantity,
            })),
            media: full.version.media.map((item: { url: string }) => item.url),
        });
    }

    const wasRejected = owned.rows[0].status === "rejected";
    await pool.query(
        `UPDATE post SET status = 'pending', updated_at = NOW(), resubmit_count = resubmit_count + $2 WHERE id = $1`,
        [postId, wasRejected ? 1 : 0],
    );
    await writeAuditLog({ actor: author, action: "post.submit", targetUserId: author.id, metadata: { postId } });
    return { status: "ok" as const, post: await getPostById(postId) };
}

export async function deleteOwnPost(postId: number, author: SessionUser) {
    const owned = await pool.query(`SELECT status, current_version_id AS "versionId" FROM post WHERE id = $1 AND author_id = $2`, [postId, author.id]);
    if (!owned.rows[0]) return { status: "not-found" as const };
    if (owned.rows[0].status === "approved") {
        return { status: "locked" as const };
    }

    const media = await pool.query<{ url: string }>(`SELECT url FROM post_media WHERE post_version_id = $1`, [owned.rows[0].versionId]);
    await pool.query(`DELETE FROM post WHERE id = $1`, [postId]);
    for (const row of media.rows) await deleteUploadedMedia(row.url);

    await writeAuditLog({ actor: author, action: "post.delete-own", targetUserId: author.id, metadata: { postId } });
    return { status: "ok" as const };
}

export async function getPostById(id: number) {
    const { rows } = await pool.query(
        `
            SELECT p.id, p.author_id AS "authorId", p.status, p.current_version_id AS "currentVersionId",
                   p.rejection_reason AS "rejectionReason", p.resubmit_count AS "resubmitCount",
                   p.created_at AS "createdAt", p.published_at AS "publishedAt",
                   u.name AS "authorName", u.image AS "authorImage"
            FROM post p
            JOIN "user" u ON u.id = p.author_id
            WHERE p.id = $1
        `,
        [id],
    );
    if (!rows[0]) return null;

    const post = rows[0];
    if (!post.currentVersionId) return { ...post, version: null };

    const versionResult = await pool.query(
        `
            SELECT pv.id, pv.version_number AS "versionNumber", pv.description, pv.point,
                   pv.fishing_method AS "fishingMethod", pv.income, pv.fishing_minutes AS "fishingMinutes",
                   pv.waterbody_id AS "waterbodyId", w.name AS "waterbodyName"
            FROM post_version pv
            LEFT JOIN waterbody w ON w.id = pv.waterbody_id
            WHERE pv.id = $1
        `,
        [post.currentVersionId],
    );
    const version = versionResult.rows[0];
    if (!version) return { ...post, version: null };

    const catches = await pool.query(
        `SELECT c.id, c.fish_id AS "fishId", c.weight, c.quantity, f.name AS "fishName", f.rarity FROM catch c JOIN fish f ON f.id = c.fish_id WHERE c.post_version_id = $1 ORDER BY c.id`,
        [version.id],
    );
    const media = await pool.query(`SELECT id, url, order_index AS "orderIndex" FROM post_media WHERE post_version_id = $1 ORDER BY order_index, id`, [version.id]);

    return {
        ...post,
        version: {
            ...version,
            incomePerHour: incomePerHour(version.income, version.fishingMinutes),
            catches: catches.rows,
            media: media.rows,
        },
    };
}

export async function listMyPosts(authorId: string, query: MyPostsQuery) {
    const values: unknown[] = [authorId];
    let whereSql = `WHERE p.author_id = $1`;
    if (query.status) {
        values.push(query.status);
        whereSql += ` AND p.status = $${values.length}`;
    }

    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM post p ${whereSql}`, values);
    values.push(query.limit, query.offset);
    const { rows } = await pool.query(
        `
            SELECT p.id, p.status, p.created_at AS "createdAt", p.published_at AS "publishedAt", p.rejection_reason AS "rejectionReason",
                   pv.description, w.name AS "waterbodyName",
                   (SELECT url FROM post_media WHERE post_version_id = pv.id ORDER BY order_index, id LIMIT 1) AS "coverUrl"
            FROM post p
            LEFT JOIN post_version pv ON pv.id = p.current_version_id
            LEFT JOIN waterbody w ON w.id = pv.waterbody_id
            ${whereSql}
            ORDER BY p.created_at DESC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return { items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

type FeedQuery = z.infer<typeof feedQuerySchema>;
type PaginationQuery = z.infer<typeof paginationQuerySchema>;

const feedSelect = `
    p.id, p.published_at AS "publishedAt",
    u.id AS "authorId", u.name AS "authorName", u.image AS "authorImage",
    pv.description, pv.fishing_method AS "fishingMethod", pv.income, pv.fishing_minutes AS "fishingMinutes",
    w.name AS "waterbodyName",
    (SELECT url FROM post_media WHERE post_version_id = pv.id ORDER BY order_index, id LIMIT 1) AS "coverUrl",
    (SELECT COUNT(*)::int FROM catch WHERE post_version_id = pv.id) AS "catchCount"
`;

function withIncomePerHour<T extends { income: number | null; fishingMinutes: number | null }>(row: T) {
    return { ...row, incomePerHour: incomePerHour(row.income, row.fishingMinutes) };
}

export async function listFeed(query: FeedQuery) {
    const where: string[] = [`p.status = 'approved'`];
    const values: unknown[] = [];

    if (query.search) {
        values.push(`%${query.search}%`);
        where.push(`pv.description ILIKE $${values.length}`);
    }
    if (query.waterbodyIds.length) {
        values.push(query.waterbodyIds);
        where.push(`pv.waterbody_id = ANY($${values.length}::int[])`);
    }
    if (query.fishingMethod) {
        values.push(query.fishingMethod);
        where.push(`pv.fishing_method = $${values.length}`);
    }
    if (query.fishIds.length) {
        values.push(query.fishIds);
        where.push(`EXISTS (SELECT 1 FROM catch c WHERE c.post_version_id = pv.id AND c.fish_id = ANY($${values.length}::int[]))`);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const orderSql =
        query.sortBy === "incomePerHour"
            ? `(pv.income::numeric * 60 / NULLIF(pv.fishing_minutes, 0)) DESC NULLS LAST, p.published_at DESC`
            : `p.published_at DESC, p.id DESC`;

    const countResult = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM post p JOIN post_version pv ON pv.id = p.current_version_id ${whereSql}`,
        values,
    );

    values.push(query.limit, query.offset);
    const { rows } = await pool.query(
        `
            SELECT ${feedSelect}
            FROM post p
            JOIN post_version pv ON pv.id = p.current_version_id
            JOIN "user" u ON u.id = p.author_id
            LEFT JOIN waterbody w ON w.id = pv.waterbody_id
            ${whereSql}
            ORDER BY ${orderSql}
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return { items: rows.map(withIncomePerHour), total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function getAuthorProfile(authorId: string, query: PaginationQuery) {
    const userResult = await pool.query(`SELECT id, name, image, role, "createdAt" FROM "user" WHERE id = $1`, [authorId]);
    if (!userResult.rows[0]) return null;

    const statsResult = await pool.query<{ postCount: number; totalIncome: string }>(
        `
            SELECT COUNT(*)::int AS "postCount", COALESCE(SUM(pv.income), 0)::bigint AS "totalIncome"
            FROM post p
            JOIN post_version pv ON pv.id = p.current_version_id
            WHERE p.author_id = $1 AND p.status = 'approved'
        `,
        [authorId],
    );

    const { rows } = await pool.query(
        `
            SELECT ${feedSelect}
            FROM post p
            JOIN post_version pv ON pv.id = p.current_version_id
            JOIN "user" u ON u.id = p.author_id
            LEFT JOIN waterbody w ON w.id = pv.waterbody_id
            WHERE p.status = 'approved' AND p.author_id = $1
            ORDER BY p.published_at DESC, p.id DESC
            LIMIT $2 OFFSET $3
        `,
        [authorId, query.limit, query.offset],
    );

    return {
        author: userResult.rows[0],
        stats: { postCount: statsResult.rows[0].postCount, totalIncome: Number(statsResult.rows[0].totalIncome) },
        posts: rows.map(withIncomePerHour),
        limit: query.limit,
        offset: query.offset,
    };
}
