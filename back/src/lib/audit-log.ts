import { randomUUID } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth/types";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { pool } from "./db";

type AuditUser = {
    id?: string;
    email?: string | null;
    role?: string | string[] | null;
};

type AuditLogInput = {
    actor?: AuditUser | null;
    action: string;
    targetUserId?: string | null;
    targetEmail?: string | null;
    metadata?: Record<string, unknown>;
};

const sensitiveKeys = new Set([
    "password",
    "newPassword",
    "currentPassword",
    "token",
    "sessionToken",
    "accessToken",
    "refreshToken",
    "idToken",
]);

function normalizeRole(role?: string | string[] | null) {
    return Array.isArray(role) ? role.join(",") : role ?? null;
}

function sanitizeMetadata(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeMetadata(item));
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
            key,
            sensitiveKeys.has(key) ? "[redacted]" : sanitizeMetadata(item),
        ]),
    );
}

export async function writeAuditLog(input: AuditLogInput) {
    await pool.query(
        `
            INSERT INTO "adminAuditLog" (
                id,
                "actorId",
                "actorEmail",
                "actorRole",
                action,
                "targetUserId",
                "targetEmail",
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
            randomUUID(),
            input.actor?.id ?? null,
            input.actor?.email ?? null,
            normalizeRole(input.actor?.role),
            input.action,
            input.targetUserId ?? null,
            input.targetEmail ?? null,
            JSON.stringify(sanitizeMetadata(input.metadata ?? {})),
        ],
    );
}

function targetUserIdFromBody(body: Record<string, unknown>) {
    if (typeof body.userId === "string") return body.userId;
    if (typeof body.id === "string") return body.id;
    return null;
}

function actionFromPath(path: string) {
    return `better-auth${path.replaceAll("/", ".")}`;
}

export function adminAuditPlugin(): BetterAuthPlugin {
    const auditedPaths = new Set([
        "/admin/create-user",
        "/admin/update-user",
        "/admin/ban-user",
        "/admin/unban-user",
        "/admin/impersonate-user",
        "/admin/revoke-user-session",
        "/admin/revoke-user-sessions",
        "/admin/remove-user",
        "/admin/set-user-password",
        "/update-user",
        "/change-password",
        "/send-verification-email",
        "/request-password-reset",
        "/reset-password",
    ]);

    return {
        id: "admin-audit-log",
        hooks: {
            after: [
                {
                    matcher(ctx) {
                        return auditedPaths.has(ctx.path ?? "");
                    },
                    handler: createAuthMiddleware(async (ctx) => {
                        const body = (ctx.body ?? {}) as Record<string, unknown>;
                        const session = await getSessionFromCtx(ctx).catch(() => null);
                        const email = typeof body.email === "string" ? body.email : null;

                        await writeAuditLog({
                            actor: session?.user ?? null,
                            action: actionFromPath(ctx.path ?? ""),
                            targetUserId: targetUserIdFromBody(body),
                            targetEmail: email,
                            metadata: {
                                path: ctx.path,
                                body,
                            },
                        }).catch((error) => {
                            console.warn("Failed to write audit log", error);
                        });
                    }),
                },
            ],
        },
    };
}

export async function logAuthEmail(type: "verification" | "password-reset", email: string, url: string) {
    console.info(`[auth-email:${type}] ${email}: ${url}`);

    await writeAuditLog({
        action: `email.${type}.sent`,
        targetEmail: email,
        metadata: {
            delivery: "console",
        },
    }).catch((error) => {
        console.warn("Failed to write auth email audit log", error);
    });
}
