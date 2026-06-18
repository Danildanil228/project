import type { BetterAuthPlugin } from "better-auth/types";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { defaultAc } from "better-auth/plugins/admin/access";

export const ADMIN_ROLE = "admin";
export const MODERATOR_ROLE = "moderator";
export const USER_ROLE = "user";
export const SUPER_ADMIN_ROLE = "super-admin";

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

export function normalizeRoles(role?: string | string[] | null) {
    if (Array.isArray(role)) return role;

    return String(role ?? USER_ROLE)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

export function hasRole(user: UserWithRole | null | undefined, role: string) {
    return normalizeRoles(user?.role).includes(role);
}

export function roleRank(role: string) {
    const ranks: Record<string, number> = {
        [USER_ROLE]: 1,
        [MODERATOR_ROLE]: 2,
        [ADMIN_ROLE]: 3,
        [SUPER_ADMIN_ROLE]: 4,
    };

    return ranks[role] ?? ranks[USER_ROLE];
}

export function highestRoleRank(user: UserWithRole | null | undefined, superAdminUserIds: string[] = []) {
    if (isSuperAdmin(user, superAdminUserIds)) return roleRank(SUPER_ADMIN_ROLE);

    return Math.max(...normalizeRoles(user?.role).map(roleRank), roleRank(USER_ROLE));
}

export function canManageRoleRank(actor: UserWithRole | null | undefined, targetRole: string, superAdminUserIds: string[] = []) {
    return highestRoleRank(actor, superAdminUserIds) > roleRank(targetRole);
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

function highestInputRoleRank(role: unknown) {
    const roles = Array.isArray(role) ? role : [role];
    return Math.max(...roles.map((value) => roleRank(String(value || USER_ROLE).trim())), roleRank(USER_ROLE));
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

                        if (path === "/admin/update-user" && body.userId === session.user.id && body.data?.role === undefined && body.role === undefined) {
                            return;
                        }

                        const targetUser = await resolveTargetUser(ctx);
                        if (isSuperAdmin(targetUser, superAdminUserIds)) {
                            throw new APIError("FORBIDDEN", {
                                message: "Super admin cannot be managed",
                            });
                        }

                        const nextRole = body.role ?? body.data?.role;
                        if ((path.endsWith("/set-role") || path === "/admin/create-user" || path === "/admin/update-user" || (path === "" && looksLikeSetRole)) && nextRole !== undefined) {
                            const actorRank = highestRoleRank(session.user, superAdminUserIds);
                            if (actorRank <= highestInputRoleRank(nextRole)) {
                                throw new APIError("FORBIDDEN", {
                                    message: "Users can assign only lower roles",
                                });
                            }
                        }

                        if (targetUser) {
                            const actorRank = highestRoleRank(session.user, superAdminUserIds);
                            const targetRank = highestRoleRank(targetUser, superAdminUserIds);

                            if (actorRank <= targetRank) {
                                throw new APIError("FORBIDDEN", {
                                    message: "Users can manage only lower role users",
                                });
                            }
                        }

                        if (!isModeratorOnly(session.user, superAdminUserIds)) return;

                        // Moderators are never allowed to impersonate, regardless of target role.
                        if (path === "/admin/impersonate-user") {
                            throw new APIError("FORBIDDEN", {
                                message: "Moderators cannot impersonate users",
                            });
                        }

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
