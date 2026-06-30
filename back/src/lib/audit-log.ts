import { randomUUID } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth/types";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { pool } from "./db";
import { getAuditContext } from "./audit-context";

type AuditUser = {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string | string[] | null;
};

type AuditLogInput = {
    actor?: AuditUser | null;
    action: string;
    targetUserId?: string | null;
    targetEmail?: string | null;
    targetName?: string | null;
    metadata?: Record<string, unknown>;
    outcome?: "success" | "failure";
};

const sensitiveKeys = new Set([
    "password",
    "newpassword",
    "currentpassword",
    "token",
    "sessiontoken",
    "accesstoken",
    "refreshtoken",
    "idtoken",
    "authorization",
    "cookie",
    "secret",
    "code",
]);

function normalizeRole(role?: string | string[] | null) {
    return Array.isArray(role) ? role.join(",") : role ?? null;
}

export function sanitizeAuditMetadata(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeAuditMetadata(item));
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
            key,
            sensitiveKeys.has(key.toLowerCase()) || /(?:password|token|secret)$/i.test(key) ? "[redacted]" : sanitizeAuditMetadata(item),
        ]),
    );
}

export async function writeAuditLog(input: AuditLogInput) {
    const request = getAuditContext();
    const actor = input.actor ?? request?.actor ?? null;
    let targetEmail = input.targetEmail ?? null;
    let targetName = input.targetName ?? null;

    if (input.targetUserId && (!targetEmail || !targetName)) {
        const target = await pool.query<{ email: string; name: string | null }>(
            `SELECT email, name FROM "user" WHERE id = $1`,
            [input.targetUserId],
        );
        targetEmail ??= target.rows[0]?.email ?? null;
        targetName ??= target.rows[0]?.name ?? null;
    }

    await pool.query(
        `
            INSERT INTO "adminAuditLog" (
                id,
                "actorId",
                "actorEmail",
                "actorName",
                "actorRole",
                action,
                "targetUserId",
                "targetEmail",
                "targetName",
                metadata,
                outcome,
                "requestId",
                "ipAddress",
                "userAgent",
                method,
                path
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `,
        [
            randomUUID(),
            actor?.id ?? null,
            actor?.email ?? null,
            actor?.name ?? null,
            normalizeRole(actor?.role),
            input.action,
            input.targetUserId ?? null,
            targetEmail,
            targetName,
            JSON.stringify(sanitizeAuditMetadata(input.metadata ?? {})),
            input.outcome ?? "success",
            request?.requestId ?? null,
            request?.ipAddress ?? null,
            request?.userAgent ?? null,
            request?.method ?? null,
            request?.path ?? null,
        ],
    );
    if (request && input.outcome === "failure") request.hasFailureEvent = true;
}

function targetUserIdFromBody(body: Record<string, unknown>) {
    if (typeof body.userId === "string") return body.userId;
    if (typeof body.id === "string") return body.id;
    return null;
}

export function auditActionFromPath(path: string) {
    const actions: Record<string, string> = {
        "/sign-up/email": "auth.register",
        "/sign-in/email": "auth.login",
        "/sign-out": "auth.logout",
        "/update-user": "auth.profile.update",
        "/change-password": "auth.password.change",
        "/change-email": "auth.email.change",
        "/delete-user": "auth.user.delete",
        "/revoke-session": "auth.session.revoke",
        "/revoke-sessions": "auth.sessions.revoke-all",
        "/revoke-other-sessions": "auth.sessions.revoke-others",
        "/link-social": "auth.account.link",
        "/unlink-account": "auth.account.unlink",
        "/admin/impersonate-user": "admin.user.impersonate",
        "/admin/stop-impersonating": "admin.user.stop-impersonating",
        "/send-verification-email": "auth.email.verification-request",
        "/request-password-reset": "auth.password.reset-request",
        "/reset-password": "auth.password.reset-complete",
    };
    if (path.startsWith("/callback/") || path.startsWith("/oauth2/callback/")) return "auth.login.social";
    if (actions[path]) return actions[path];
    return `better-auth${path.replaceAll("/", ".")}`;
}

export function adminAuditPlugin(): BetterAuthPlugin {
    const auditedPaths = new Set([
        "/admin/create-user",
        "/admin/update-user",
        "/admin/ban-user",
        "/admin/unban-user",
        "/admin/impersonate-user",
        "/admin/stop-impersonating",
        "/admin/revoke-user-session",
        "/admin/revoke-user-sessions",
        "/admin/remove-user",
        "/admin/set-user-password",
        "/update-user",
        "/change-password",
        "/send-verification-email",
        "/request-password-reset",
        "/reset-password",
        "/sign-up/email",
        "/sign-in/email",
        "/sign-out",
        "/change-email",
        "/delete-user",
        "/revoke-session",
        "/revoke-sessions",
        "/revoke-other-sessions",
        "/link-social",
        "/unlink-account",
    ]);

    const isAuditedPath = (path: string) =>
        auditedPaths.has(path) || path.startsWith("/callback/") || path.startsWith("/oauth2/callback/");

    return {
        id: "admin-audit-log",
        hooks: {
            before: [
                {
                    matcher(ctx) {
                        return isAuditedPath(ctx.path ?? "");
                    },
                    handler: createAuthMiddleware(async (ctx) => {
                        const session = await getSessionFromCtx(ctx).catch(() => null);
                        return { context: { auditActor: session?.user ?? null } };
                    }),
                },
            ],
            after: [
                {
                    matcher(ctx) {
                        return isAuditedPath(ctx.path ?? "");
                    },
                    handler: createAuthMiddleware(async (ctx) => {
                        const body = (ctx.body ?? {}) as Record<string, unknown>;
                        const session = await getSessionFromCtx(ctx).catch(() => null);
                        const context = ctx.context as typeof ctx.context & { auditActor?: AuditUser | null };
                        const returned = context.returned;
                        const failed = returned instanceof Error;
                        const responseUser =
                            !failed && returned && typeof returned === "object" && "user" in returned
                                ? ((returned as { user?: AuditUser | null }).user ?? null)
                                : null;
                        const actor = context.auditActor ?? session?.user ?? responseUser;
                        const email = typeof body.email === "string" ? body.email : actor?.email ?? null;
                        const baseAction = auditActionFromPath(ctx.path ?? "");

                        await writeAuditLog({
                            actor,
                            action: failed ? `${baseAction}.failed` : baseAction,
                            outcome: failed ? "failure" : "success",
                            targetUserId: targetUserIdFromBody(body) ?? actor?.id ?? null,
                            targetEmail: email,
                            metadata: {
                                path: ctx.path,
                                body,
                                ...(failed ? { error: returned.name } : {}),
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
