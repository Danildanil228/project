// User-facing account routes (profile-level: check has-password, request a password change with
// email-code confirmation). Lives outside better-auth's plugins so we can layer our own UX (require
// old password + 6-digit code) before calling auth.api.changePassword.

import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { pool } from "../lib/db";
import { logAuthEmail, writeAuditLog } from "../lib/audit-log";

export const accountRouter = Router();

// In-memory store for pending password-change confirmations.
// Keyed by userId. TTL 10 min. Holds plaintext old + new passwords just long enough to call
// auth.api.changePassword once the code is confirmed, then evicted. Acceptable for dev; in prod
// move to Redis with the same TTL.
type Pending = { code: string; currentPassword: string; newPassword: string; expiresAt: number };
const pending = new Map<string, Pending>();

function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanupExpired() {
    const now = Date.now();
    for (const [userId, entry] of pending.entries()) {
        if (entry.expiresAt <= now) pending.delete(userId);
    }
}

// Tells the UI whether a change-password form is meaningful. False means OAuth-only — hide the form.
accountRouter.get("/has-password", async (req, res, next) => {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { rows } = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS(SELECT 1 FROM account WHERE "userId" = $1 AND "providerId" = 'credential' AND password IS NOT NULL) AS exists`,
            [session.user.id],
        );
        res.json({ hasPassword: rows[0]?.exists === true });
    } catch (error) {
        next(error);
    }
});

// Step 1: verify the old password, stash the new one, send a 6-digit code to the user's email.
// We log the code via logAuthEmail (which goes to stdout in dev — same as verification / password-reset emails).
accountRouter.post("/password/request", async (req, res, next) => {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
        if (typeof currentPassword !== "string" || currentPassword.length === 0) {
            res.status(400).json({ message: "currentPassword required" });
            return;
        }
        if (typeof newPassword !== "string" || newPassword.length < 8) {
            res.status(400).json({ message: "newPassword must be at least 8 chars" });
            return;
        }

        // verifyPassword would be cleaner but isn't reliably exposed across better-auth versions.
        // We let auth.api.changePassword reject in step 2 if currentPassword is wrong — but we also
        // pre-check it now so we don't email a code for the wrong password.
        try {
            await auth.api.verifyPassword({
                body: { password: currentPassword, userId: session.user.id },
                headers: fromNodeHeaders(req.headers),
            } as Parameters<typeof auth.api.verifyPassword>[0]);
        } catch {
            res.status(403).json({ message: "Текущий пароль неверный" });
            return;
        }

        cleanupExpired();
        const code = generateCode();
        pending.set(session.user.id, {
            code,
            currentPassword,
            newPassword,
            expiresAt: Date.now() + 10 * 60 * 1000,
        });

        // Code lands in server logs (same channel as the existing verification emails).
        await logAuthEmail("password-change-code", session.user.email, code);

        res.json({ success: true, expiresIn: 600 });
    } catch (error) {
        next(error);
    }
});

// Step 2: confirm the code, apply the password change via better-auth, evict the pending entry.
accountRouter.post("/password/confirm", async (req, res, next) => {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { code } = (req.body ?? {}) as { code?: string };
        if (typeof code !== "string" || code.length !== 6) {
            res.status(400).json({ message: "Введите 6-значный код" });
            return;
        }

        cleanupExpired();
        const entry = pending.get(session.user.id);
        if (!entry) {
            res.status(404).json({ message: "Нет ожидающего подтверждения. Запросите смену пароля заново." });
            return;
        }
        if (entry.code !== code) {
            res.status(403).json({ message: "Неверный код" });
            return;
        }

        await auth.api.changePassword({
            body: {
                currentPassword: entry.currentPassword,
                newPassword: entry.newPassword,
            },
            headers: fromNodeHeaders(req.headers),
        });
        pending.delete(session.user.id);

        await writeAuditLog({
            action: "user.password.change",
            actor: session.user,
            targetUserId: session.user.id,
            targetEmail: session.user.email,
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});
