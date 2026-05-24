import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";
import { canManageRoleRank, hasElevatedAccess, hasRole, highestRoleRank, isSuperAdminId, roleRank } from "./admin-roles";
import { pool } from "./db";

export type SessionUser = {
    id: string;
    email?: string;
    name?: string;
    role?: string | string[] | null;
};

export const superAdminUserIds = process.env.BETTER_AUTH_ADMIN_USER_IDS
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

export async function requireAdmin(req: Request, res: Response) {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
        res.status(401).json({ message: "Authentication required" });
        return null;
    }

    if (!hasElevatedAccess(session.user as SessionUser, superAdminUserIds)) {
        res.status(403).json({ message: "Admin access required" });
        return null;
    }

    return session;
}

export function isModeratorOnly(user: SessionUser) {
    return hasRole(user, "moderator") && !hasRole(user, "admin") && !isSuperAdminId(user.id, superAdminUserIds);
}

export async function isAdminTarget(userId: string) {
    if (isSuperAdminId(userId, superAdminUserIds)) return true;

    const { rows } = await pool.query<{ role: string | null }>(
        `SELECT role FROM "user" WHERE id = $1`,
        [userId],
    );

    return hasRole({ id: userId, role: rows[0]?.role }, "admin");
}

export async function canManageTarget(actor: SessionUser, targetUserId: string, nextRole?: string) {
    if (targetUserId === actor.id) {
        return { allowed: false, message: "Users cannot manage themselves with this action" };
    }

    if (isSuperAdminId(targetUserId, superAdminUserIds)) {
        return { allowed: false, message: "Super admin cannot be managed" };
    }

    const { rows } = await pool.query<{ role: string | null }>(
        `SELECT role FROM "user" WHERE id = $1`,
        [targetUserId],
    );
    const targetUser = { id: targetUserId, role: rows[0]?.role };
    const actorRank = highestRoleRank(actor, superAdminUserIds);
    const targetRank = highestRoleRank(targetUser, superAdminUserIds);

    if (actorRank <= targetRank) {
        return { allowed: false, message: "Users can manage only lower role users" };
    }

    if (nextRole && !canManageRoleRank(actor, nextRole, superAdminUserIds)) {
        return { allowed: false, message: "Users can assign only lower roles" };
    }

    if (isModeratorOnly(actor) && (targetRank >= roleRank("admin") || nextRole === "admin")) {
        return { allowed: false, message: "Moderators cannot manage admin users" };
    }

    return { allowed: true, message: "" };
}
