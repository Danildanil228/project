import type { PoolClient } from "pg";
import type { z } from "zod";
import { canManageTarget, type SessionUser, superAdminUserIds } from "../lib/admin-auth";
import { isSuperAdminId } from "../lib/admin-roles";
import { writeAuditLog } from "../lib/audit-log";
import { pool } from "../lib/db";
import type { bulkBanBodySchema, bulkRoleBodySchema, bulkUserIdsSchema, listUsersQuerySchema } from "../lib/validation";

const allowedRoles = new Set(["admin", "moderator", "user"]);
const userSortFields = new Map([
    ["createdAt", `"createdAt"`],
    ["updatedAt", `"updatedAt"`],
    ["email", "email"],
    ["name", "name"],
    ["role", "role"],
]);

export function buildUserListQuery(query: z.infer<typeof listUsersQuerySchema>, limitOverride?: number) {
    const limit = Math.min(Math.max(Number(limitOverride ?? query.limit), 1), 5000);
    const offset = Math.max(Number(query.offset), 0);
    const sortBy = userSortFields.get(query.sortBy) ?? `"createdAt"`;
    const sortDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.searchValue) {
        values.push(`%${query.searchValue}%`);
        where.push(`${query.searchField} ILIKE $${values.length}`);
    }

    if (allowedRoles.has(query.role)) {
        values.push(query.role);
        where.push(`role = $${values.length}`);
    }

    if (query.status === "active") {
        where.push(`COALESCE(banned, false) = false`);
    }

    if (query.status === "banned") {
        where.push(`banned = true`);
    }

    if (query.emailVerified === "true" || query.emailVerified === "false") {
        values.push(query.emailVerified === "true");
        where.push(`"emailVerified" = $${values.length}`);
    }

    return {
        limit,
        offset,
        whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
        sortSql: `${sortBy} ${sortDirection}, id ASC`,
        values,
    };
}

function escapeCsvValue(value: unknown) {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
}

export function usersToCsv(rows: Record<string, unknown>[]) {
    const headers = [
        "id",
        "name",
        "email",
        "emailVerified",
        "role",
        "banned",
        "banReason",
        "banExpires",
        "createdAt",
        "updatedAt",
    ];

    return [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
    ].join("\n");
}

export async function listManagedUsers(query: z.infer<typeof listUsersQuerySchema>) {
    const { limit, offset, whereSql, sortSql, values } = buildUserListQuery(query);
    const countResult = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "user" ${whereSql}`,
        values,
    );

    values.push(limit, offset);
    const { rows } = await pool.query(
        `
            SELECT
                id,
                name,
                email,
                "emailVerified",
                image,
                role,
                banned,
                "banReason",
                "banExpires",
                "createdAt",
                "updatedAt"
            FROM "user"
            ${whereSql}
            ORDER BY ${sortSql}
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
    );

    return {
        users: rows,
        total: countResult.rows[0]?.count ?? 0,
        limit,
        offset,
    };
}

export async function getManagedUser(userId: string) {
    const { rows } = await pool.query(
        `
            SELECT
                id,
                name,
                email,
                "emailVerified",
                image,
                role,
                banned,
                "banReason",
                "banExpires",
                "createdAt",
                "updatedAt"
            FROM "user"
            WHERE id = $1
        `,
        [userId],
    );

    return rows[0] ?? null;
}

export async function exportManagedUsers(query: z.infer<typeof listUsersQuerySchema>, actor: SessionUser) {
    const { whereSql, sortSql, values } = buildUserListQuery(query, 5000);
    values.push(5000);

    const { rows } = await pool.query(
        `
            SELECT
                id,
                name,
                email,
                "emailVerified",
                role,
                banned,
                "banReason",
                "banExpires",
                "createdAt",
                "updatedAt"
            FROM "user"
            ${whereSql}
            ORDER BY ${sortSql}
            LIMIT $${values.length}
        `,
        values,
    );

    await writeAuditLog({
        actor,
        action: "admin.users.export",
        metadata: {
            count: rows.length,
            query,
        },
    });

    return usersToCsv(rows);
}

export async function validateBulkTargets(actor: SessionUser, userIds: string[], nextRole?: string) {
    for (const userId of userIds) {
        const permission = await canManageTarget(actor, userId, nextRole);
        if (!permission.allowed) {
            return {
                allowed: false,
                message: permission.message,
                userId,
            };
        }
    }

    return {
        allowed: true,
        message: "",
        userId: "",
    };
}

export async function bulkSetUserRole(actor: SessionUser, body: z.infer<typeof bulkRoleBodySchema>) {
    const { rows } = await pool.query(
        `
            UPDATE "user"
            SET role = $1, "updatedAt" = NOW()
            WHERE id = ANY($2::text[])
            RETURNING id, email
        `,
        [body.role, body.userIds],
    );

    await Promise.all(
        rows.map((user) =>
            writeAuditLog({
                actor,
                action: "admin.users.bulk-role",
                targetUserId: user.id,
                targetEmail: user.email,
                metadata: { role: body.role },
            }),
        ),
    );

    return rows.length;
}

export async function bulkBanUsers(actor: SessionUser, body: z.infer<typeof bulkBanBodySchema>) {
    const { rows } = await pool.query(
        `
            UPDATE "user"
            SET banned = true, "banReason" = $1, "banExpires" = $2, "updatedAt" = NOW()
            WHERE id = ANY($3::text[])
            RETURNING id, email
        `,
        [body.reason || null, body.expiresAt ? new Date(body.expiresAt) : null, body.userIds],
    );

    await Promise.all(
        rows.map((user) =>
            writeAuditLog({
                actor,
                action: "admin.users.bulk-ban",
                targetUserId: user.id,
                targetEmail: user.email,
                metadata: {
                    reason: body.reason || null,
                    expiresAt: body.expiresAt || null,
                },
            }),
        ),
    );

    return rows.length;
}

export async function bulkUnbanUsers(actor: SessionUser, body: z.infer<typeof bulkUserIdsSchema>) {
    const { rows } = await pool.query(
        `
            UPDATE "user"
            SET banned = false, "banReason" = NULL, "banExpires" = NULL, "updatedAt" = NOW()
            WHERE id = ANY($1::text[])
            RETURNING id, email
        `,
        [body.userIds],
    );

    await Promise.all(
        rows.map((user) =>
            writeAuditLog({
                actor,
                action: "admin.users.bulk-unban",
                targetUserId: user.id,
                targetEmail: user.email,
            }),
        ),
    );

    return rows.length;
}

export async function updateUserRole(actor: SessionUser, targetUserId: string, role: string) {
    const { rows } = await pool.query(
        `
            UPDATE "user"
            SET role = $1, "updatedAt" = NOW()
            WHERE id = $2
            RETURNING id, name, email, "emailVerified", image, role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
        `,
        [role, targetUserId],
    );

    if (!rows[0]) return null;

    await writeAuditLog({
        actor,
        action: "admin.user.role.update",
        targetUserId,
        targetEmail: rows[0].email,
        metadata: {
            role,
        },
    });

    return rows[0];
}

export async function listManagedAccounts(userId: string) {
    if (isSuperAdminId(userId, superAdminUserIds)) {
        return null;
    }

    const { rows } = await pool.query(
        `
            SELECT
                id,
                "providerId",
                "accountId",
                "userId",
                scope,
                "createdAt",
                "updatedAt",
                ("accessToken" IS NOT NULL) AS "hasAccessToken",
                ("refreshToken" IS NOT NULL) AS "hasRefreshToken",
                ("idToken" IS NOT NULL) AS "hasIdToken",
                (password IS NOT NULL) AS "hasPassword"
            FROM "account"
            WHERE "userId" = $1
            ORDER BY "createdAt" DESC
        `,
        [userId],
    );

    return rows;
}

export async function unlinkManagedAccount(client: PoolClient, actor: SessionUser, accountId: string, userId: string) {
    await client.query("BEGIN");

    const accountResult = await client.query(
        `
            SELECT id, "userId", "providerId", "accountId"
            FROM "account"
            WHERE id = $1 AND "userId" = $2
            FOR UPDATE
        `,
        [accountId, userId],
    );

    if (accountResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return { status: "not-found" as const };
    }

    const countResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM "account" WHERE "userId" = $1`,
        [userId],
    );

    if (Number(countResult.rows[0]?.count ?? 0) <= 1) {
        await client.query("ROLLBACK");
        return { status: "last-account" as const };
    }

    await client.query(`DELETE FROM "account" WHERE id = $1 AND "userId" = $2`, [accountId, userId]);
    await client.query("COMMIT");

    await writeAuditLog({
        actor,
        action: "admin.account.unlink",
        targetUserId: userId,
        metadata: {
            accountId,
            providerId: accountResult.rows[0].providerId,
        },
    });

    return { status: "ok" as const, account: accountResult.rows[0] };
}
