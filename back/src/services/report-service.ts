import { pool } from "../lib/db";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";
import { createNotification, notifyModerators } from "./notification-service";

export async function createReport(postId: number, reporter: SessionUser, reason: string) {
    const post = await pool.query<{ status: string; authorId: string }>(
        `SELECT status, author_id AS "authorId" FROM post WHERE id = $1`,
        [postId],
    );
    if (!post.rows[0]) return { status: "not-found" as const };
    if (post.rows[0].status !== "approved") return { status: "invalid" as const };

    const inserted = await pool.query<{ id: number }>(
        `INSERT INTO report (post_id, reporter_id, reason) VALUES ($1, $2, $3)
         ON CONFLICT (post_id, reporter_id) DO NOTHING RETURNING id`,
        [postId, reporter.id, reason],
    );
    if (!inserted.rows[0]) return { status: "duplicate" as const };

    await writeAuditLog({ actor: reporter, action: "report.create", metadata: { postId, reportId: inserted.rows[0].id, reason } });
    await notifyModerators({ type: "report_new", postId, actorId: reporter.id, data: { reason: reason.slice(0, 120) }, excludeUserId: reporter.id });

    return { status: "ok" as const };
}

export async function listReports(query: { status: "open" | "resolved" | "rejected" | ""; limit: number; offset: number }) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.status) {
        values.push(query.status);
        where.push(`r.status = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM report r ${whereSql}`, values);
    values.push(query.limit, query.offset);

    const { rows } = await pool.query(
        `
            SELECT r.id, r.post_id AS "postId", r.reason, r.status, r.created_at AS "createdAt",
                   r.resolved_at AS "resolvedAt", rb.name AS "resolvedByName",
                   ru.id AS "reporterId", ru.name AS "reporterName",
                   p.status AS "postStatus",
                   pa.name AS "postAuthorName",
                   pv.description AS "postDescription",
                   (SELECT COUNT(*)::int FROM report r2 WHERE r2.post_id = r.post_id AND r2.status = 'open') AS "openReportsForPost"
            FROM report r
            JOIN "user" ru ON ru.id = r.reporter_id
            LEFT JOIN "user" rb ON rb.id = r.resolved_by
            JOIN post p ON p.id = r.post_id
            JOIN "user" pa ON pa.id = p.author_id
            LEFT JOIN post_version pv ON pv.id = p.current_version_id
            ${whereSql}
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return { items: rows, total: countResult.rows[0]?.count ?? 0, limit: query.limit, offset: query.offset };
}

export async function countOpenReports() {
    const { rows } = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM report WHERE status = 'open'`);
    return rows[0]?.count ?? 0;
}

export async function resolveReport(reportId: number, moderator: SessionUser, status: "resolved" | "rejected") {
    const { rows } = await pool.query<{ reporterId: string; postId: number }>(
        `UPDATE report SET status = $2, resolved_by = $3, resolved_at = NOW()
         WHERE id = $1 AND status = 'open'
         RETURNING reporter_id AS "reporterId", post_id AS "postId"`,
        [reportId, status, moderator.id],
    );
    if (!rows[0]) return { status: "invalid" as const };

    await writeAuditLog({ actor: moderator, action: `report.${status}`, metadata: { reportId, postId: rows[0].postId } });
    return { status: "ok" as const };
}
