import type { PoolClient } from "pg";
import type { z } from "zod";
import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import { superAdminUserIds, type SessionUser } from "../lib/admin-auth";
import { hasElevatedAccess } from "../lib/admin-roles";
import { deleteUploadedMedia } from "../lib/uploads";
import { translateDbError } from "../lib/db-errors";
import { notifyModerators } from "./notification-service";
import { notifyAdmins, publicSiteUrl } from "./telegram-notify";
import { createPendingMapSubmission } from "./map-submission-service";
import { postMapLinkingEnabled } from "../lib/features";
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

// API output sanitiser. Curated posts purposely don't expose their underlying author — UI shows
// "Сообщество" instead, and there's no clickable profile link. The DB still stores author_id for
// audit ("which moderator created this curated post?") but we never surface it to the client.
function stripAuthorIfCurated<T extends { isCurated?: boolean | null; authorId?: string | null; authorName?: string | null; authorImage?: string | null }>(row: T): T {
    if (!row.isCurated) return row;
    return { ...row, authorId: null, authorName: null, authorImage: null };
}

export function assertSubmittable(content: PostContent) {
    const problems: string[] = [];
    if (!content.waterbodyId) problems.push("укажите водоём");
    if (!content.fishingMethod) problems.push("укажите вид ловли");
    if (!content.point) problems.push("укажите точку или клипсу");
    if (content.catches.length === 0) problems.push("добавьте хотя бы одну рыбу");
    if (content.media.length === 0) problems.push("добавьте хотя бы одно фото");
    if (problems.length) {
        throw Object.assign(new Error(`Не удалось отправить пост: ${problems.join(", ")}`), { statusCode: 400 });
    }
}

export async function assertCatchHabitats(content: PostContent) {
    if (!content.waterbodyId || !content.catches.length) return;
    const fishIds = [...new Set(content.catches.map((item) => item.fishId))];
    const allowed = await pool.query<{ fishId: number }>(
        `SELECT fish_id AS "fishId" FROM waterbody_fish WHERE waterbody_id=$1 AND fish_id=ANY($2::int[])`,
        [content.waterbodyId, fishIds],
    );
    if (allowed.rowCount !== fishIds.length) {
        throw Object.assign(new Error("В улове можно выбрать только рыб, обитающих в указанном водоёме"), { statusCode: 400 });
    }
}

// A draft is allowed to be incomplete, but it must contain at least *something* — otherwise
// users accidentally accumulate empty rows in their "Мои посты" list.
function assertHasContent(content: PostContent) {
    const hasAny =
        (content.description?.trim().length ?? 0) > 0 ||
        content.waterbodyId != null ||
        (content.point?.trim().length ?? 0) > 0 ||
        content.fishingMethod != null ||
        content.income != null ||
        content.fishingMinutes != null ||
        content.catches.length > 0 ||
        content.media.length > 0;
    if (!hasAny) {
        throw Object.assign(new Error("Пустой пост сохранить нельзя — заполните хотя бы одно поле"), { statusCode: 400 });
    }
}

export async function insertVersionChildren(client: PoolClient, versionId: number, content: PostContent) {
    // Catches are now just "which fish species were caught" — dedupe by fishId so duplicates in the
    // form payload (e.g. selected then re-selected) don't produce ghost rows.
    const seenFishIds = new Set<number>();
    for (const item of content.catches) {
        if (seenFishIds.has(item.fishId)) continue;
        seenFishIds.add(item.fishId);
        await client.query(`INSERT INTO catch (post_version_id, fish_id) VALUES ($1, $2)`, [versionId, item.fishId]);
    }
    if (content.baitMode === "common") {
        for (const baitId of content.commonBaitIds) {
            await client.query(`INSERT INTO post_version_bait (post_version_id, bait_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [versionId, baitId]);
        }
    } else {
        for (const item of content.catches) {
            for (const baitId of item.baitIds) {
                await client.query(`INSERT INTO post_version_bait (post_version_id, fish_id, bait_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [versionId, item.fishId, baitId]);
            }
        }
    }
    for (let index = 0; index < content.media.length; index += 1) {
        await client.query(
            `INSERT INTO post_media (post_version_id, url, order_index) VALUES ($1, $2, $3)`,
            [versionId, content.media[index], index],
        );
    }
}

export async function createPost(author: SessionUser, input: CreatePostInput) {
    // Curated posts: only moderator+ may set this. Forces publish-without-review regardless
    // of `submit` (the editor UI already toggles submit=true alongside isCurated).
    const isCurated = Boolean(input.isCurated);
    if (isCurated && !hasElevatedAccess(author, superAdminUserIds)) {
        throw Object.assign(new Error("Только модератор может публиковать посты от сообщества"), { statusCode: 403 });
    }

    if (input.submit || isCurated) assertSubmittable(input);
    else assertHasContent(input);
    await assertCatchHabitats(input);

    const publishDirectly = isCurated || (input.submit && input.skipModeration && hasElevatedAccess(author, superAdminUserIds));
    const status = (isCurated || input.submit) ? (publishDirectly ? "approved" : "pending") : "draft";

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const postResult = await client.query(
            `INSERT INTO post (author_id, status, published_at, is_curated, curated_label) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [author.id, status, publishDirectly ? new Date() : null, isCurated, isCurated ? (input.curatedLabel ?? null) : null],
        );
        const postId = postResult.rows[0].id;

        const versionResult = await client.query(
            `INSERT INTO post_version (post_id, version_number, description, waterbody_id, point, fishing_method, income, fishing_minutes, proposed_spot_id, map_x, map_y, game_coordinate_x, game_coordinate_y, map_x2, map_y2, game_coordinate_x2, game_coordinate_y2, bait_mode)
             VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
            [postId, input.description, input.waterbodyId, input.point, input.fishingMethod, input.income, input.fishingMinutes, input.proposedSpotId, input.mapX, input.mapY, input.gameCoordinateX, input.gameCoordinateY, input.mapX2, input.mapY2, input.gameCoordinateX2, input.gameCoordinateY2, input.baitMode],
        );
        const versionId = versionResult.rows[0].id;

        await insertVersionChildren(client, versionId, input);
        await client.query(`UPDATE post SET current_version_id = $1 WHERE id = $2`, [versionId, postId]);
        const mapSubmissionId = postMapLinkingEnabled && publishDirectly ? await createPendingMapSubmission(client, postId, versionId) : null;
        await client.query("COMMIT");

        await writeAuditLog({
            actor: author,
            action: isCurated ? "post.curated.create" : publishDirectly ? "post.publish-direct" : input.submit ? "post.submit" : "post.create-draft",
            targetUserId: author.id,
            metadata: { postId, ...(isCurated ? { curatedLabel: input.curatedLabel ?? null } : {}) },
        });
        if (status === "pending") {
            await notifyModerators({ type: "moderation_new", postId, actorId: author.id, excludeUserId: author.id });
            // Fire-and-forget the Telegram push; errors are logged inside notifyAdmins → sendMessage
            // so a single broken chat won't roll back the post create transaction.
            await notifyAdmins(`📝 *Новый пост на модерации*\n[Открыть #${postId}](${publicSiteUrl()}/posts/${postId})`);
        }
        if (mapSubmissionId) await notifyModerators({ type: "map_submission_new", postId, actorId: author.id, excludeUserId: author.id, data: { mapSubmissionId } });
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
    else assertHasContent(content);
    await assertCatchHabitats(content);

    const versionId = owned.rows[0].versionId as number;
    const previousMedia = await pool.query<{ url: string }>(`SELECT url FROM post_media WHERE post_version_id = $1`, [versionId]);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE post_version SET description=$1, waterbody_id=$2, point=$3, fishing_method=$4, income=$5, fishing_minutes=$6, proposed_spot_id=$7, map_x=$8, map_y=$9, game_coordinate_x=$10, game_coordinate_y=$11, map_x2=$12, map_y2=$13, game_coordinate_x2=$14, game_coordinate_y2=$15, bait_mode=$16 WHERE id=$17`,
            [content.description, content.waterbodyId, content.point, content.fishingMethod, content.income, content.fishingMinutes, content.proposedSpotId, content.mapX, content.mapY, content.gameCoordinateX, content.gameCoordinateY, content.mapX2, content.mapY2, content.gameCoordinateX2, content.gameCoordinateY2, content.baitMode, versionId],
        );
        await client.query(`DELETE FROM catch WHERE post_version_id = $1`, [versionId]);
        await client.query(`DELETE FROM post_media WHERE post_version_id = $1`, [versionId]);
        await client.query(`DELETE FROM post_version_bait WHERE post_version_id = $1`, [versionId]);
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
    if (submit) {
        await notifyModerators({ type: "moderation_new", postId, actorId: author.id, excludeUserId: author.id });
        await notifyAdmins(`📝 *Пост повторно отправлен на модерацию*\n[Открыть #${postId}](${publicSiteUrl()}/posts/${postId})`);
    }
    return { status: "ok" as const, post: await getPostById(postId) };
}

// Curated post editor — moderator+ may rewrite a curated post irrespective of who originally
// authored it. Status stays `approved`; we just replace the current version's content. The
// editor UI also lets the moderator change the curated_label (or unset isCurated to demote
// the post back to a regular pending one, but we treat that as out of scope for v1).
export async function updateCuratedPost(postId: number, moderator: SessionUser, content: PostContent, label: string | null) {
    if (!hasElevatedAccess(moderator, superAdminUserIds)) {
        throw Object.assign(new Error("Только модератор может редактировать посты сообщества"), { statusCode: 403 });
    }
    const owned = await pool.query<{ versionId: number | null; isCurated: boolean }>(
        `SELECT current_version_id AS "versionId", is_curated AS "isCurated" FROM post WHERE id = $1`,
        [postId],
    );
    if (!owned.rows[0] || !owned.rows[0].versionId) return { status: "not-found" as const };
    if (!owned.rows[0].isCurated) return { status: "not-curated" as const };

    assertSubmittable(content);
    await assertCatchHabitats(content);

    const versionId = owned.rows[0].versionId;
    const previousMedia = await pool.query<{ url: string }>(`SELECT url FROM post_media WHERE post_version_id = $1`, [versionId]);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE post_version SET description=$1, waterbody_id=$2, point=$3, fishing_method=$4, income=$5, fishing_minutes=$6, proposed_spot_id=$7, map_x=$8, map_y=$9, game_coordinate_x=$10, game_coordinate_y=$11, map_x2=$12, map_y2=$13, game_coordinate_x2=$14, game_coordinate_y2=$15, bait_mode=$16 WHERE id=$17`,
            [content.description, content.waterbodyId, content.point, content.fishingMethod, content.income, content.fishingMinutes, content.proposedSpotId, content.mapX, content.mapY, content.gameCoordinateX, content.gameCoordinateY, content.mapX2, content.mapY2, content.gameCoordinateX2, content.gameCoordinateY2, content.baitMode, versionId],
        );
        await client.query(`DELETE FROM catch WHERE post_version_id = $1`, [versionId]);
        await client.query(`DELETE FROM post_media WHERE post_version_id = $1`, [versionId]);
        await client.query(`DELETE FROM post_version_bait WHERE post_version_id = $1`, [versionId]);
        await insertVersionChildren(client, versionId, content);
        await client.query(`UPDATE post SET curated_label = $1, updated_at = NOW() WHERE id = $2`, [label, postId]);
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

    await writeAuditLog({ actor: moderator, action: "post.curated.update", targetUserId: moderator.id, metadata: { postId } });
    return { status: "ok" as const, post: await getPostById(postId) };
}

// True when the post exists and is curated — UI uses this to decide which update endpoint to call.
export async function isCuratedPost(postId: number): Promise<boolean> {
    const { rows } = await pool.query<{ isCurated: boolean }>(`SELECT is_curated AS "isCurated" FROM post WHERE id = $1`, [postId]);
    return Boolean(rows[0]?.isCurated);
}

export async function submitDraft(postId: number, author: SessionUser) {
    const owned = await pool.query(`SELECT status FROM post WHERE id = $1 AND author_id = $2`, [postId, author.id]);
    if (!owned.rows[0]) return { status: "not-found" as const };
    if (!editableStatuses.has(owned.rows[0].status)) return { status: "locked" as const };

    const full = await getPostById(postId);
    if (full?.version) {
        const content = {
            description: full.version.description ?? "",
            waterbodyId: full.version.waterbodyId,
            point: full.version.point,
            fishingMethod: full.version.fishingMethod,
            income: full.version.income,
            fishingMinutes: full.version.fishingMinutes,
            catches: full.version.catches.map((item: { fishId: number; baits: Array<{ id: number }> }) => ({ fishId: item.fishId, baitIds: item.baits.map((bait) => bait.id) })),
            baitMode: full.version.baitMode,
            commonBaitIds: full.version.commonBaits.map((item: { id: number }) => item.id),
            proposedSpotId: full.version.proposedSpotId,
            mapX: full.version.mapX,
            mapY: full.version.mapY,
            gameCoordinateX: full.version.gameCoordinateX,
            gameCoordinateY: full.version.gameCoordinateY,
            mapX2: full.version.mapX2,
            mapY2: full.version.mapY2,
            gameCoordinateX2: full.version.gameCoordinateX2,
            gameCoordinateY2: full.version.gameCoordinateY2,
            media: full.version.media.map((item: { url: string }) => item.url),
        };
        assertSubmittable(content);
        await assertCatchHabitats(content);
    }

    const wasRejected = owned.rows[0].status === "rejected";
    await pool.query(
        `UPDATE post SET status = 'pending', updated_at = NOW(), resubmit_count = resubmit_count + $2 WHERE id = $1`,
        [postId, wasRejected ? 1 : 0],
    );
    await writeAuditLog({ actor: author, action: "post.submit", targetUserId: author.id, metadata: { postId } });
    await notifyModerators({ type: "moderation_new", postId, actorId: author.id, excludeUserId: author.id });
    await notifyAdmins(`📝 *Новый пост на модерации*\n[Открыть #${postId}](${publicSiteUrl()}/posts/${postId})`);
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
                   p.view_count AS "viewCount", p.pinned_at AS "pinnedAt",
                   p.created_at AS "createdAt", p.published_at AS "publishedAt",
                   p.is_curated AS "isCurated", p.curated_label AS "curatedLabel",
                   u.name AS "authorName", u.image AS "authorImage"
            FROM post p
            LEFT JOIN "user" u ON u.id = p.author_id
            WHERE p.id = $1
        `,
        [id],
    );
    if (!rows[0]) return null;

    const post = stripAuthorIfCurated(rows[0]);
    if (!post.currentVersionId) return { ...post, version: null };

    const versionResult = await pool.query(
        `
            SELECT pv.id, pv.version_number AS "versionNumber", pv.description, pv.point,
                   pv.fishing_method AS "fishingMethod", pv.income, pv.fishing_minutes AS "fishingMinutes",
                   pv.waterbody_id AS "waterbodyId", w.name AS "waterbodyName", pv.proposed_spot_id AS "proposedSpotId",
                   pv.map_x::float AS "mapX", pv.map_y::float AS "mapY", pv.game_coordinate_x::float AS "gameCoordinateX",
                   pv.game_coordinate_y::float AS "gameCoordinateY",
                   pv.map_x2::float AS "mapX2", pv.map_y2::float AS "mapY2", pv.game_coordinate_x2::float AS "gameCoordinateX2",
                   pv.game_coordinate_y2::float AS "gameCoordinateY2", pv.bait_mode AS "baitMode"
            FROM post_version pv
            LEFT JOIN waterbody w ON w.id = pv.waterbody_id
            WHERE pv.id = $1
        `,
        [post.currentVersionId],
    );
    const version = versionResult.rows[0];
    if (!version) return { ...post, version: null };

    const catches = await pool.query(
        `SELECT c.id, c.fish_id AS "fishId", f.name AS "fishName", f.photo AS "fishPhoto", f.rarity FROM catch c JOIN fish f ON f.id = c.fish_id WHERE c.post_version_id = $1 ORDER BY c.id`,
        [version.id],
    );
    const media = await pool.query(`SELECT id, url, order_index AS "orderIndex" FROM post_media WHERE post_version_id = $1 ORDER BY order_index, id`, [version.id]);
    const baits = await pool.query(`SELECT pvb.fish_id AS "fishId", b.id, b.name, b.kind FROM post_version_bait pvb JOIN bait b ON b.id=pvb.bait_id WHERE pvb.post_version_id=$1 ORDER BY b.name`, [version.id]);

    return {
        ...post,
        version: {
            ...version,
            incomePerHour: incomePerHour(version.income, version.fishingMinutes),
            catches: catches.rows.map((item) => ({ ...item, baits: baits.rows.filter((bait) => Number(bait.fishId) === Number(item.fishId)).map(({ fishId: _fishId, ...bait }) => bait) })),
            commonBaits: baits.rows.filter((bait) => bait.fishId === null).map(({ fishId: _fishId, ...bait }) => bait),
            media: media.rows,
        },
    };
}

export async function listMyPosts(authorId: string, query: MyPostsQuery) {
    const values: unknown[] = [authorId];
    // Curated posts are not "personal" — even though the moderator's id is the author_id (for audit),
    // they're managed via /moderation, not via "Мои посты".
    let whereSql = `WHERE p.author_id = $1 AND NOT p.is_curated`;
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
    p.id, p.published_at AS "publishedAt", p.view_count AS "viewCount", p.pinned_at AS "pinnedAt",
    p.is_curated AS "isCurated", p.curated_label AS "curatedLabel",
    u.id AS "authorId", u.name AS "authorName", u.image AS "authorImage",
    pv.description, pv.point, pv.fishing_method AS "fishingMethod", pv.income, pv.fishing_minutes AS "fishingMinutes",
    w.name AS "waterbodyName",
    COALESCE((SELECT json_agg(url ORDER BY order_index, id) FROM post_media WHERE post_version_id = pv.id), '[]'::json) AS "mediaUrls",
    (SELECT COUNT(*)::int FROM catch WHERE post_version_id = pv.id) AS "catchCount",
    COALESCE((SELECT json_agg(f.name ORDER BY c.id) FROM catch c JOIN fish f ON f.id = c.fish_id WHERE c.post_version_id = pv.id), '[]'::json) AS "fishNames",
    (SELECT COUNT(*)::int FROM reaction WHERE post_id = p.id AND value = 1) AS likes,
    (SELECT COUNT(*)::int FROM reaction WHERE post_id = p.id AND value = -1) AS dislikes
`;

function withIncomePerHour<T extends { income: number | null; fishingMinutes: number | null }>(row: T) {
    return { ...row, incomePerHour: incomePerHour(row.income, row.fishingMinutes) };
}

export async function listFeed(query: FeedQuery) {
    const where: string[] = [`p.status = 'approved'`];
    const values: unknown[] = [];

    if (query.search) {
        values.push(`%${query.search}%`);
        const idx = values.length;
        where.push(
            `(pv.description ILIKE $${idx} OR pv.point ILIKE $${idx} OR w.name ILIKE $${idx} OR EXISTS (SELECT 1 FROM catch c JOIN fish f ON f.id = c.fish_id WHERE c.post_version_id = pv.id AND f.name ILIKE $${idx}))`,
        );
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
    // Pinned posts always come first (most recently pinned at the top of the pinned tier),
    // then the user-selected sort applies inside the regular tier.
    const orderSql =
        query.sortBy === "incomePerHour"
            ? `p.pinned_at DESC NULLS LAST, (pv.income::numeric * 60 / NULLIF(pv.fishing_minutes, 0)) DESC NULLS LAST, p.published_at DESC`
            : `p.pinned_at DESC NULLS LAST, p.published_at DESC, p.id DESC`;

    const countResult = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM post p JOIN post_version pv ON pv.id = p.current_version_id LEFT JOIN waterbody w ON w.id = pv.waterbody_id ${whereSql}`,
        values,
    );

    values.push(query.limit, query.offset);
    const { rows } = await pool.query(
        `
            SELECT ${feedSelect}
            FROM post p
            JOIN post_version pv ON pv.id = p.current_version_id
            LEFT JOIN "user" u ON u.id = p.author_id
            LEFT JOIN waterbody w ON w.id = pv.waterbody_id
            ${whereSql}
            ORDER BY ${orderSql}
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return { items: rows.map(withIncomePerHour).map(stripAuthorIfCurated), total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
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
            -- Curated posts intentionally don't show on the moderator's author page —
            -- they belong to "Сообщество" in the UI, not to the moderator personally.
            WHERE p.status = 'approved' AND p.author_id = $1 AND NOT p.is_curated
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

// Only counts views for approved posts so drafts/pending/rejected views never inflate the number.
export async function incrementViewCount(postId: number) {
    const { rowCount } = await pool.query(
        `UPDATE post SET view_count = view_count + 1 WHERE id = $1 AND status = 'approved' RETURNING id`,
        [postId],
    );
    if (!rowCount) return { status: "not-found" as const };
    return { status: "ok" as const };
}
