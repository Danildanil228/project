import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { canManageTarget, requireAdmin, type SessionUser, superAdminUserIds } from "../lib/admin-auth";
import { hasElevatedAccess, isSuperAdmin } from "../lib/admin-roles";
import { pool } from "../lib/db";
import {
    accountDeleteBodySchema,
    auditLogExportQuerySchema,
    auditLogQuerySchema,
    bulkBanBodySchema,
    bulkRoleBodySchema,
    bulkUserIdsSchema,
    listUsersQuerySchema,
    parseOrSend,
    roleBodySchema,
    userIdParamsSchema,
} from "../lib/validation";
import { exportAuditLogs, listAuditLogs } from "../services/admin-audit-service";
import {
    bulkBanUsers,
    bulkSetUserRole,
    bulkUnbanUsers,
    exportManagedUsers,
    getManagedUser,
    listManagedAccounts,
    listManagedUsers,
    unlinkManagedAccount,
    updateUserRole,
    validateBulkTargets,
} from "../services/admin-users-service";

const router = Router();

router.get("/users", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const query = parseOrSend(listUsersQuerySchema, req.query, res);
        if (!query) return;

        res.json(await listManagedUsers(query));
    } catch (error) {
        next(error);
    }
});

router.get("/users/export.csv", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const query = parseOrSend(listUsersQuerySchema, req.query, res);
        if (!query) return;

        const csv = await exportManagedUsers(query, session.user as SessionUser);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="users-export.csv"`);
        res.send(`\uFEFF${csv}`);
    } catch (error) {
        next(error);
    }
});

router.get("/users/:userId", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const params = parseOrSend(userIdParamsSchema, req.params, res);
        if (!params) return;

        const user = await getManagedUser(params.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.json({ user });
    } catch (error) {
        next(error);
    }
});

router.get("/audit-logs", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const query = parseOrSend(auditLogQuerySchema, req.query, res);
        if (!query) return;

        res.json(await listAuditLogs(query));
    } catch (error) {
        next(error);
    }
});

router.get("/audit-logs/export.csv", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const query = parseOrSend(auditLogExportQuerySchema, req.query, res);
        if (!query) return;

        const csv = await exportAuditLogs(query, session.user as SessionUser);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="audit-logs-export.csv"`);
        res.send(`\uFEFF${csv}`);
    } catch (error) {
        next(error);
    }
});

router.get("/context", async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session?.user) {
            res.status(401).json({ message: "Authentication required" });
            return;
        }

        const user = session.user as SessionUser;
        const canUseAdmin = hasElevatedAccess(user, superAdminUserIds);

        res.json({
            currentUserId: user.id,
            hasElevatedAccess: canUseAdmin,
            isSuperAdmin: isSuperAdmin(user, superAdminUserIds),
            superAdminUserIds: canUseAdmin ? superAdminUserIds : [],
        });
    } catch (error) {
        next(error);
    }
});

router.post("/users/bulk-role", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const body = parseOrSend(bulkRoleBodySchema, req.body, res);
        if (!body) return;

        const actor = session.user as SessionUser;
        const permission = await validateBulkTargets(actor, body.userIds, body.role);
        if (!permission.allowed) {
            res.status(403).json({ message: permission.message, userId: permission.userId });
            return;
        }

        res.json({ updated: await bulkSetUserRole(actor, body) });
    } catch (error) {
        next(error);
    }
});

router.post("/users/bulk-ban", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const body = parseOrSend(bulkBanBodySchema, req.body, res);
        if (!body) return;

        const actor = session.user as SessionUser;
        const permission = await validateBulkTargets(actor, body.userIds);
        if (!permission.allowed) {
            res.status(403).json({ message: permission.message, userId: permission.userId });
            return;
        }

        res.json({ updated: await bulkBanUsers(actor, body) });
    } catch (error) {
        next(error);
    }
});

router.post("/users/bulk-unban", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const body = parseOrSend(bulkUserIdsSchema, req.body, res);
        if (!body) return;

        const actor = session.user as SessionUser;
        const permission = await validateBulkTargets(actor, body.userIds);
        if (!permission.allowed) {
            res.status(403).json({ message: permission.message, userId: permission.userId });
            return;
        }

        res.json({ updated: await bulkUnbanUsers(actor, body) });
    } catch (error) {
        next(error);
    }
});

router.patch("/users/:userId/role", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const params = parseOrSend(userIdParamsSchema, req.params, res);
        const body = parseOrSend(roleBodySchema, req.body, res);
        if (!params || !body) return;

        const actor = session.user as SessionUser;
        const permission = await canManageTarget(actor, params.userId, body.role);
        if (!permission.allowed) {
            res.status(403).json({ message: permission.message });
            return;
        }

        const user = await updateUserRole(actor, params.userId, body.role);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.json({ user });
    } catch (error) {
        next(error);
    }
});

router.get("/accounts/:userId", async (req, res, next) => {
    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const params = parseOrSend(userIdParamsSchema, req.params, res);
        if (!params) return;

        const accounts = await listManagedAccounts(params.userId);
        if (!accounts) {
            res.status(403).json({ message: "Super admin cannot be managed" });
            return;
        }

        res.json({ accounts });
    } catch (error) {
        next(error);
    }
});

router.delete("/accounts/:accountId", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const session = await requireAdmin(req, res);
        if (!session) return;

        const body = parseOrSend(accountDeleteBodySchema, req.body, res);
        if (!body) return;

        const actor = session.user as SessionUser;
        const permission = await canManageTarget(actor, body.userId);
        if (!permission.allowed) {
            res.status(403).json({ message: permission.message });
            return;
        }

        const result = await unlinkManagedAccount(client, actor, req.params.accountId, body.userId);

        if (result.status === "not-found") {
            res.status(404).json({ message: "Account not found" });
            return;
        }

        if (result.status === "last-account") {
            res.status(400).json({ message: "Cannot unlink the user's last account" });
            return;
        }

        res.json({ account: result.account });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        next(error);
    } finally {
        client.release();
    }
});

export const adminAccountsRouter = router;
