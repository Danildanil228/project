import type { z } from "zod";
import { writeAuditLog } from "../lib/audit-log";
import { pool } from "../lib/db";
import type { auditLogExportQuerySchema, auditLogQuerySchema } from "../lib/validation";
import type { SessionUser } from "../lib/admin-auth";

type AuditQuery = z.infer<typeof auditLogQuerySchema> | z.infer<typeof auditLogExportQuerySchema>;

function escapeCsvValue(value: unknown) {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
}

function auditLogsToCsv(rows: Record<string, unknown>[]) {
    const headers = [
        "id",
        "actorId",
        "actorEmail",
        "actorName",
        "actorRole",
        "action",
        "targetUserId",
        "targetEmail",
        "targetName",
        "outcome",
        "requestId",
        "ipAddress",
        "userAgent",
        "method",
        "path",
        "metadata",
        "createdAt",
    ];

    return [
        headers.join(","),
        ...rows.map((row) =>
            headers
                .map((header) => escapeCsvValue(header === "metadata" ? JSON.stringify(row[header] ?? {}) : row[header]))
                .join(","),
        ),
    ].join("\n");
}

function buildAuditLogQuery(query: AuditQuery) {
    const values: unknown[] = [];
    const where: string[] = [];

    if (query.targetUserId) {
        values.push(query.targetUserId);
        where.push(`log."targetUserId" = $${values.length}`);
    }

    if (query.actorEmail) {
        values.push(`%${query.actorEmail}%`);
        where.push(`log."actorEmail" ILIKE $${values.length}`);
    }

    if (query.targetEmail) {
        values.push(`%${query.targetEmail}%`);
        where.push(`log."targetEmail" ILIKE $${values.length}`);
    }

    if (query.action) {
        values.push(`%${query.action}%`);
        where.push(`log.action ILIKE $${values.length}`);
    }

    if (query.userId) {
        values.push(query.userId);
        where.push(`(
            log."actorId" = $${values.length}
            OR log."targetUserId" = $${values.length}
            OR EXISTS (
                SELECT 1 FROM post user_post
                WHERE user_post.author_id = $${values.length}
                  AND user_post.id = CASE
                      WHEN (log.metadata->>'postId') ~ '^[0-9]+$' THEN (log.metadata->>'postId')::int
                      ELSE NULL
                  END
            )
        )`);
    }

    if (query.outcome) {
        values.push(query.outcome);
        where.push(`log.outcome = $${values.length}`);
    }

    if (query.from) {
        values.push(new Date(query.from));
        where.push(`log."createdAt" >= $${values.length}`);
    }

    if (query.to) {
        values.push(new Date(query.to));
        where.push(`log."createdAt" <= $${values.length}`);
    }

    return {
        values,
        whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    };
}

export async function listAuditLogs(query: z.infer<typeof auditLogQuerySchema>) {
    const { limit, offset } = query;
    const { values, whereSql } = buildAuditLogQuery(query);
    const countResult = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "adminAuditLog" log ${whereSql}`,
        values,
    );

    values.push(limit, offset);
    const { rows } = await pool.query(
        `
            SELECT
                log.id,
                log."actorId",
                COALESCE(log."actorEmail", actor.email) AS "actorEmail",
                COALESCE(log."actorName", actor.name) AS "actorName",
                log."actorRole",
                log.action,
                log."targetUserId",
                COALESCE(log."targetEmail", target.email, content_target.email) AS "targetEmail",
                COALESCE(log."targetName", target.name, content_target.name) AS "targetName",
                log.outcome,
                log."requestId",
                log."ipAddress",
                log."userAgent",
                log.method,
                log.path,
                log.metadata,
                log."createdAt"
            FROM "adminAuditLog" log
            LEFT JOIN "user" actor ON actor.id = log."actorId"
            LEFT JOIN "user" target ON target.id = log."targetUserId"
            LEFT JOIN post content_post ON content_post.id = CASE
                WHEN (log.metadata->>'postId') ~ '^[0-9]+$' THEN (log.metadata->>'postId')::int
                ELSE NULL
            END
            LEFT JOIN "user" content_target ON content_target.id = content_post.author_id
            ${whereSql}
            ORDER BY log."createdAt" DESC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return {
        logs: rows,
        total: countResult.rows[0]?.count ?? 0,
        limit,
        offset,
    };
}

export async function exportAuditLogs(query: z.infer<typeof auditLogExportQuerySchema>, actor: SessionUser) {
    const { values, whereSql } = buildAuditLogQuery(query);
    values.push(query.limit);

    const { rows } = await pool.query(
        `
            SELECT
                log.id,
                log."actorId",
                COALESCE(log."actorEmail", actor.email) AS "actorEmail",
                COALESCE(log."actorName", actor.name) AS "actorName",
                log."actorRole",
                log.action,
                log."targetUserId",
                COALESCE(log."targetEmail", target.email, content_target.email) AS "targetEmail",
                COALESCE(log."targetName", target.name, content_target.name) AS "targetName",
                log.outcome,
                log."requestId",
                log."ipAddress",
                log."userAgent",
                log.method,
                log.path,
                log.metadata,
                log."createdAt"
            FROM "adminAuditLog" log
            LEFT JOIN "user" actor ON actor.id = log."actorId"
            LEFT JOIN "user" target ON target.id = log."targetUserId"
            LEFT JOIN post content_post ON content_post.id = CASE
                WHEN (log.metadata->>'postId') ~ '^[0-9]+$' THEN (log.metadata->>'postId')::int
                ELSE NULL
            END
            LEFT JOIN "user" content_target ON content_target.id = content_post.author_id
            ${whereSql}
            ORDER BY log."createdAt" DESC
            LIMIT $${values.length}
        `,
        values,
    );

    await writeAuditLog({
        actor,
        action: "admin.audit.export",
        metadata: {
            count: rows.length,
            query,
        },
    });

    return auditLogsToCsv(rows);
}
