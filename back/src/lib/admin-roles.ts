import type { BetterAuthPlugin } from "better-auth/types";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { defaultAc } from "better-auth/plugins/admin/access";

export const ADMIN_ROLE = "admin";
export const MODERATOR_ROLE = "moderator";
export const USER_ROLE = "user";

export const elevatedRoles = [ADMIN_ROLE, MODERATOR_ROLE];

export const adminAccessControlRoles = {
    admin: defaultAc.newRole({
        user: ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"],
        session: ["list", "revoke", "delete"],
    }),
    moderator: defaultAc.newRole({
        user: ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"],
        session: ["list", "revoke", "delete"],
    }),
    user: defaultAc.newRole({
        user: [],
        session: [],
    }),
};

type UserWithRole = {
    id: string;
    role?: string | string[] | null;
};

function normalizeRoles(role?: string | string[] | null) {
    if (Array.isArray(role)) return role;

    return String(role ?? USER_ROLE)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

export function hasRole(user: UserWithRole | null | undefined, role: string) {
    return normalizeRoles(user?.role).includes(role);
}

export function isSuperAdmin(user: UserWithRole | null | undefined, superAdminUserIds: string[] = []) {
    return Boolean(user?.id && superAdminUserIds.includes(user.id));
}

export function isSuperAdminId(userId: string | null | undefined, superAdminUserIds: string[] = []) {
    return Boolean(userId && superAdminUserIds.includes(userId));
}

export function hasElevatedAccess(user: UserWithRole | null | undefined, superAdminUserIds: string[] = []) {
    return isSuperAdmin(user, superAdminUserIds) || normalizeRoles(user?.role).some((role) => elevatedRoles.includes(role));
}

function isModeratorOnly(user: UserWithRole | null | undefined, superAdminUserIds: string[]) {
    if (!user || isSuperAdmin(user, superAdminUserIds)) return false;
    const roles = normalizeRoles(user.role);
    return roles.includes(MODERATOR_ROLE) && !roles.includes(ADMIN_ROLE);
}

function isAdminTarget(user: UserWithRole | null | undefined, superAdminUserIds: string[]) {
    return Boolean(user && (isSuperAdmin(user, superAdminUserIds) || normalizeRoles(user.role).includes(ADMIN_ROLE)));
}

function roleInputIncludesAdmin(role: unknown) {
    const roles = Array.isArray(role) ? role : [role];
    return roles.some((value) => String(value).trim() === ADMIN_ROLE);
}

async function resolveTargetUser(ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]) {
    const path = ctx.path;
    const body = ctx.body as {
        userId?: string;
        role?: string | string[];
        data?: { role?: string | string[] };
        sessionToken?: string;
    };

    if (path === "/admin/revoke-user-session" && body.sessionToken) {
        const session = await ctx.context.internalAdapter.findSession(body.sessionToken);
        return session?.user ?? null;
    }

    if (!body.userId) return null;
    return ctx.context.internalAdapter.findUserById(body.userId);
}

export function adminHierarchyGuard(superAdminUserIds: string[]): BetterAuthPlugin {
    const guardedPaths = new Set([
        "/admin/set-role",
        "/admin/create-user",
        "/admin/update-user",
        "/admin/ban-user",
        "/admin/unban-user",
        "/admin/impersonate-user",
        "/admin/list-user-sessions",
        "/admin/revoke-user-session",
        "/admin/revoke-user-sessions",
        "/admin/remove-user",
        "/admin/set-user-password",
    ]);

    return {
        id: "admin-hierarchy-guard",
        hooks: {
            before: [
                {
                    matcher() {
                        return true;
                    },
                    handler: createAuthMiddleware(async (ctx) => {
                        const path = ctx.path ?? "";
                        const body = (ctx.body ?? {}) as {
                            userId?: string;
                            role?: string | string[];
                            data?: { role?: string | string[] };
                        };
                        const looksLikeSetRole = body.userId !== undefined && body.role !== undefined;
                        const isGuardedPath = guardedPaths.has(path) || path.endsWith("/set-role") || (path === "" && looksLikeSetRole);
                        if (!isGuardedPath) return;

                        const session = await getSessionFromCtx(ctx);
                        if (!session) return;

                        if (
                            (path.endsWith("/set-role") || path === "/admin/update-user" || (path === "" && looksLikeSetRole)) &&
                            body.userId === session.user.id &&
                            (roleInputIncludesAdmin(body.role) || body.data?.role !== undefined)
                        ) {
                            throw new APIError("FORBIDDEN", {
                                message: "Users cannot change their own role",
                            });
                        }

                        const targetUser = await resolveTargetUser(ctx);
                        if (isSuperAdmin(targetUser, superAdminUserIds)) {
                            throw new APIError("FORBIDDEN", {
                                message: "Super admin cannot be managed",
                            });
                        }

                        if (!isModeratorOnly(session.user, superAdminUserIds)) return;

                        if (
                            ((path.endsWith("/set-role") || (path === "" && looksLikeSetRole)) && roleInputIncludesAdmin(body.role)) ||
                            (path === "/admin/create-user" && roleInputIncludesAdmin(body.role)) ||
                            (path === "/admin/update-user" && roleInputIncludesAdmin(body.data?.role))
                        ) {
                            throw new APIError("FORBIDDEN", {
                                message: "Moderators cannot assign the admin role",
                            });
                        }

                        if (isAdminTarget(targetUser, superAdminUserIds)) {
                            throw new APIError("FORBIDDEN", {
                                message: "Moderators cannot manage admin users",
                            });
                        }
                    }),
                },
            ],
        },
    };
}
