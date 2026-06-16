import type { AdminSecurityContext, ManagedUser } from "../types/admin";

export const appRoles = ["admin", "moderator", "user"] as const;
const roleRanks: Record<string, number> = {
    user: 1,
    moderator: 2,
    admin: 3,
    "super-admin": 4,
};

export function roleText(user?: ManagedUser | null) {
    if (!user?.role) return "user";
    return Array.isArray(user.role) ? user.role.join(", ") : user.role;
}

export function isAdminUser(user?: ManagedUser | null) {
    return roleText(user)
        .split(",")
        .map((role) => role.trim())
        .includes("admin");
}

export function isModeratorUser(user?: ManagedUser | null) {
    return roleText(user)
        .split(",")
        .map((role) => role.trim())
        .includes("moderator");
}

export function isSuperAdminUser(user?: ManagedUser | null, adminContext?: AdminSecurityContext | null) {
    return Boolean(user?.id && adminContext?.superAdminUserIds.includes(user.id));
}

export function displayRoleText(user?: ManagedUser | null, adminContext?: AdminSecurityContext | null) {
    return isSuperAdminUser(user, adminContext) ? "super admin" : roleText(user);
}

export function highestUserRoleRank(user?: ManagedUser | null, adminContext?: AdminSecurityContext | null) {
    if (isSuperAdminUser(user, adminContext)) return roleRanks["super-admin"];

    return Math.max(
        ...roleText(user)
            .split(",")
            .map((role) => roleRanks[role.trim()] ?? roleRanks.user),
        roleRanks.user,
    );
}

export function canManageCatalog(user?: ManagedUser | null, adminContext?: AdminSecurityContext | null) {
    return isAdminUser(user) || isSuperAdminUser(user, adminContext);
}

export function hasElevatedUserAccess(user?: ManagedUser | null, adminContext?: AdminSecurityContext | null) {
    const isCurrentContextUser = Boolean(user?.id && adminContext?.currentUserId === user.id);
    return Boolean(
        (isCurrentContextUser && adminContext?.hasElevatedAccess) ||
            isSuperAdminUser(user, adminContext) ||
            isAdminUser(user) ||
            isModeratorUser(user),
    );
}

export function canManageUser(actor?: ManagedUser | null, target?: ManagedUser | null, adminContext?: AdminSecurityContext | null) {
    if (!target) return false;
    if (isSuperAdminUser(target, adminContext)) return false;
    return highestUserRoleRank(actor, adminContext) > highestUserRoleRank(target, adminContext);
}

export function manageableRoleOptions(actor?: ManagedUser | null, adminContext?: AdminSecurityContext | null) {
    const actorRank = highestUserRoleRank(actor, adminContext);
    return appRoles.filter((role) => actorRank > roleRanks[role]);
}

export function formatDate(value?: string | Date | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ru-RU");
}

export function shortId(value?: string | null) {
    if (!value) return "-";
    if (value.length <= 14) return value;
    return `${value.slice(0, 7)}...${value.slice(-5)}`;
}

export function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        if (error.message.toLowerCase().includes("not allowed")) {
            return "У текущего пользователя нет прав администратора. Назначьте роль admin или добавьте id пользователя в BETTER_AUTH_ADMIN_USER_IDS.";
        }

        return error.message;
    }

    if (typeof error === "string") return error;
    return "Не удалось выполнить действие";
}
