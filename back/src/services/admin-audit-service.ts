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
        "actorRole",
        "action",
        "targetUserId",
        "targetEmail",
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
        where.push(`"targetUserId" = $${values.length}`);
    }

    if (query.actorEmail) {
        values.push(`%${query.actorEmail}%`);
        where.push(`"actorEmail" ILIKE $${values.length}`);
    }

    if (query.targetEmail) {
        values.push(`%${query.targetEmail}%`);
        where.push(`"targetEmail" ILIKE $${values.length}`);
    }

    if (query.action) {
        values.push(`%${query.action}%`);
        where.push(`action ILIKE $${values.length}`);
    }

    if (query.userId) {
        values.push(query.userId);
        where.push(`("actorId" = $${values.length} OR "targetUserId" = $${values.length})`);
    }

    if (query.outcome) {
        values.push(query.outcome);
        where.push(`outcome = $${values.length}`);
    }

    if (query.from) {
        values.push(new Date(query.from));
        where.push(`"createdAt" >= $${values.length}`);
    }

    if (query.to) {
        values.push(new Date(query.to));
        where.push(`"createdAt" <= $${values.length}`);
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
        `SELECT COUNT(*)::int AS count FROM "adminAuditLog" ${whereSql}`,
        values,
    );

    values.push(limit, offset);
    const { rows } = await pool.query(
        `
            SELECT
                id,
                "actorId",
                "actorEmail",
                "actorRole",
                action,
                "targetUserId",
                "targetEmail",
                outcome,
                "requestId",
                "ipAddress",
                "userAgent",
                method,
                path,
                metadata,
                "createdAt"
            FROM "adminAuditLog"
            ${whereSql}
            ORDER BY "createdAt" DESC
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
                id,
                "actorId",
                "actorEmail",
                "actorRole",
                action,
                "targetUserId",
                "targetEmail",
                outcome,
                "requestId",
                "ipAddress",
                "userAgent",
                method,
                path,
                metadata,
                "createdAt"
            FROM "adminAuditLog"
            ${whereSql}
            ORDER BY "createdAt" DESC
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
