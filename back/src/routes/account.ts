// User-facing account routes (profile-level: check has-password, request a password change with
// email-code confirmation). Lives outside better-auth's plugins so we can layer our own UX (require
// old password + 6-digit code) before calling auth.api.changePassword.

import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { hasElevatedAccess } from "../lib/admin-roles";
import { superAdminUserIds } from "../lib/admin-auth";
import { pool } from "../lib/db";
import { logAuthEmail, writeAuditLog } from "../lib/audit-log";
import { getUpdates, telegramBotUsername, telegramConfigured } from "../lib/telegram";

export const accountRouter = Router();

// In-memory store for pending password-change confirmations.
// Keyed by userId. TTL 10 min. Holds plaintext old + new passwords just long enough to call
// auth.api.changePassword once the code is confirmed, then evicted. Acceptable for dev; in prod
// move to Redis with the same TTL.
type Pending = { code: string; currentPassword: string; newPassword: string; expiresAt: number };
const pending = new Map<string, Pending>();

// Same pattern, separate Map for the signup OTP flow. Keyed by email (lowercased) — the user
// isn't logged in yet, so there's no userId. After signUpEmail succeeds the frontend calls
// /email-verify/send, then /email-verify/confirm flips emailVerified=true.
type SignupOtp = { code: string; expiresAt: number };
const signupOtps = new Map<string, SignupOtp>();

// Pending Telegram link tokens. Keyed by userId. TTL 10 min. After the user sends /start <code>
// to the bot and clicks "Проверить" in the UI, we look the code up here and turn it into a
// permanent row in telegramLink.
type PendingLink = { code: string; expiresAt: number };
const pendingTelegramLinks = new Map<string, PendingLink>();

function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanupExpired() {
    const now = Date.now();
    for (const [userId, entry] of pending.entries()) {
        if (entry.expiresAt <= now) pending.delete(userId);
    }
    for (const [email, entry] of signupOtps.entries()) {
        if (entry.expiresAt <= now) signupOtps.delete(email);
    }
    for (const [userId, entry] of pendingTelegramLinks.entries()) {
        if (entry.expiresAt <= now) pendingTelegramLinks.delete(userId);
    }
}

// Crude per-email rate limit so an attacker can't burn through codes by spamming /send.
// Allows one code every 30s per email. Returns the seconds left to wait, or 0 if ok.
function sendThrottleSeconds(email: string): number {
    const entry = signupOtps.get(email);
    if (!entry) return 0;
    const issuedAt = entry.expiresAt - 10 * 60 * 1000;
    const wait = Math.ceil((issuedAt + 30_000 - Date.now()) / 1000);
    return wait > 0 ? wait : 0;
}

// Tells the UI whether there's a still-valid pending password change for the signed-in user. The
// UI calls this on mount so a page reload during the email-code step lands back on the code form
// rather than starting over. Does NOT expose the code or stashed passwords — just yes/no + remaining seconds.
accountRouter.get("/password/pending", async (req, res, next) => {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        cleanupExpired();
        const entry = pending.get(session.user.id);
        if (!entry) {
            res.json({ pending: false });
            return;
        }
        const expiresIn = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
        res.json({ pending: true, expiresIn });
    } catch (error) {
        next(error);
    }
});

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

// --- Telegram link flow (moderator+ only) ------------------------------------------

async function requireElevated(req: import("express").Request, res: import("express").Response) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) { res.status(401).json({ message: "Unauthorized" }); return null; }
    if (!hasElevatedAccess(session.user, superAdminUserIds)) {
        res.status(403).json({ message: "Только для модераторов и админов" });
        return null;
    }
    return session;
}

accountRouter.get("/telegram/status", async (req, res, next) => {
    try {
        const session = await requireElevated(req, res);
        if (!session) return;
        const { rows } = await pool.query<{ chatId: string; username: string | null; linkedAt: string }>(
            `SELECT "chatId", "username", "linkedAt" FROM "telegramLink" WHERE "userId" = $1`,
            [session.user.id],
        );
        const link = rows[0]
            ? { linked: true as const, chatId: rows[0].chatId, username: rows[0].username, linkedAt: rows[0].linkedAt }
            : { linked: false as const };
        res.json({ ...link, botUsername: telegramBotUsername, configured: telegramConfigured });
    } catch (error) {
        next(error);
    }
});

accountRouter.post("/telegram/start-link", async (req, res, next) => {
    try {
        const session = await requireElevated(req, res);
        if (!session) return;
        if (!telegramConfigured || !telegramBotUsername) {
            res.status(503).json({ message: "Telegram-бот не настроен на сервере" });
            return;
        }
        cleanupExpired();
        const code = generateCode();
        pendingTelegramLinks.set(session.user.id, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
        res.json({
            code,
            botUsername: telegramBotUsername,
            deepLink: `https://t.me/${telegramBotUsername}?start=${code}`,
            expiresIn: 600,
        });
    } catch (error) {
        next(error);
    }
});

// Polls Telegram's getUpdates and matches the user's pending code against an incoming
// /start <code> (or bare <code>) message. On match we persist chatId+username and evict
// the pending entry.
accountRouter.post("/telegram/finish-link", async (req, res, next) => {
    try {
        const session = await requireElevated(req, res);
        if (!session) return;
        cleanupExpired();
        const entry = pendingTelegramLinks.get(session.user.id);
        if (!entry) {
            res.status(404).json({ message: "Запросите код заново" });
            return;
        }
        const updates = await getUpdates();
        const expected = entry.code;
        const match = updates.find((update) => {
            const text = update.message?.text?.trim() ?? "";
            return text === `/start ${expected}` || text === expected;
        });
        if (!match || !match.message) {
            res.status(404).json({ message: "Сообщение от вас в боте пока не найдено. Откройте бота и отправьте код." });
            return;
        }
        const chatId = match.message.chat.id;
        const username = match.message.from?.username ?? match.message.chat.username ?? null;
        try {
            await pool.query(
                `
                    INSERT INTO "telegramLink" ("userId", "chatId", "username")
                    VALUES ($1, $2, $3)
                    ON CONFLICT ("userId") DO UPDATE SET
                        "chatId"   = EXCLUDED."chatId",
                        "username" = EXCLUDED."username",
                        "linkedAt" = NOW()
                `,
                [session.user.id, chatId, username],
            );
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Не удалось связать";
            res.status(409).json({ message: /unique|duplicate/i.test(message) ? "Этот Telegram уже привязан к другому пользователю" : message });
            return;
        }
        pendingTelegramLinks.delete(session.user.id);
        await writeAuditLog({
            actor: session.user,
            action: "user.telegram.link",
            targetUserId: session.user.id,
            targetEmail: session.user.email,
            metadata: { chatId, username },
        });
        res.json({ success: true, chatId, username });
    } catch (error) {
        next(error);
    }
});

accountRouter.delete("/telegram/link", async (req, res, next) => {
    try {
        const session = await requireElevated(req, res);
        if (!session) return;
        await pool.query(`DELETE FROM "telegramLink" WHERE "userId" = $1`, [session.user.id]);
        pendingTelegramLinks.delete(session.user.id);
        await writeAuditLog({
            actor: session.user,
            action: "user.telegram.unlink",
            targetUserId: session.user.id,
            targetEmail: session.user.email,
        });
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Lightweight uniqueness check used by the register step 2 ("введите email") so we can stop the
// user before they pick a password for an address that already exists. No auth required. Doesn't
// distinguish between "taken-and-verified" and "taken-and-unverified" — both block signup the same way.
accountRouter.get("/email-available", async (req, res, next) => {
    try {
        const raw = (req.query as { email?: unknown }).email;
        if (typeof raw !== "string" || !raw.includes("@")) {
            res.status(400).json({ message: "Укажите корректный email" });
            return;
        }
        const email = raw.trim().toLowerCase();
        const { rows } = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS(SELECT 1 FROM "user" WHERE LOWER(email) = $1) AS exists`,
            [email],
        );
        res.json({ available: !rows[0]?.exists });
    } catch (error) {
        next(error);
    }
});

// Tells the modal whether the signed-up email already has a live OTP in our pending map.
// Used to restore step 4 of registration after a page reload — same idea as the password-change
// pending check. Returns false (not 404) when the email isn't known, so this is safe to call
// from a fresh tab. No auth required.
accountRouter.get("/email-verify/pending", async (req, res, next) => {
    try {
        const raw = (req.query as { email?: unknown }).email;
        if (typeof raw !== "string" || !raw.includes("@")) {
            res.json({ pending: false });
            return;
        }
        const email = raw.trim().toLowerCase();
        cleanupExpired();
        const entry = signupOtps.get(email);
        if (!entry) { res.json({ pending: false }); return; }
        const expiresIn = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
        // Same throttle as /email-verify/send — UI uses this to disable "Отправить ещё раз" until 0.
        const resendInSeconds = sendThrottleSeconds(email);
        res.json({ pending: true, expiresIn, resendInSeconds });
    } catch (error) {
        next(error);
    }
});

// Signup email-OTP — no session required (user just signed up but isn't verified yet).
// Body: { email }. Generates a 6-digit code, stashes for 10 min, logs via stdout (dev).
accountRouter.post("/email-verify/send", async (req, res, next) => {
    try {
        const raw = (req.body as { email?: unknown })?.email;
        if (typeof raw !== "string" || !raw.includes("@")) {
            res.status(400).json({ message: "Укажите email" });
            return;
        }
        const email = raw.trim().toLowerCase();

        // Don't leak whether the email exists or is already verified — but skip work in obvious cases.
        const { rows } = await pool.query<{ exists: boolean; verified: boolean }>(
            `SELECT EXISTS(SELECT 1 FROM "user" WHERE LOWER(email) = $1) AS exists,
                    COALESCE((SELECT "emailVerified" FROM "user" WHERE LOWER(email) = $1), FALSE) AS verified`,
            [email],
        );
        if (rows[0]?.verified) {
            res.json({ success: true, alreadyVerified: true });
            return;
        }
        if (!rows[0]?.exists) {
            // Pretend we sent so an attacker can't enumerate. The frontend will time out on confirm.
            res.json({ success: true });
            return;
        }

        const wait = sendThrottleSeconds(email);
        if (wait > 0) {
            res.status(429).json({ message: `Подождите ${wait} сек. перед повторной отправкой` });
            return;
        }

        cleanupExpired();
        const code = generateCode();
        signupOtps.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
        await logAuthEmail("signup-otp", email, code);
        // resendInSeconds tells the UI how long the "Отправить ещё раз" button must stay disabled.
        // Matches the same throttle window enforced on subsequent /send calls.
        res.json({ success: true, expiresIn: 600, resendInSeconds: 30 });
    } catch (error) {
        next(error);
    }
});

// Signup email-OTP confirm. Body: { email, code }. On success flips emailVerified=true.
accountRouter.post("/email-verify/confirm", async (req, res, next) => {
    try {
        const body = (req.body ?? {}) as { email?: unknown; code?: unknown };
        if (typeof body.email !== "string" || !body.email.includes("@")) {
            res.status(400).json({ message: "Укажите email" });
            return;
        }
        if (typeof body.code !== "string" || body.code.length !== 6) {
            res.status(400).json({ message: "Введите 6-значный код" });
            return;
        }
        const email = body.email.trim().toLowerCase();

        cleanupExpired();
        const entry = signupOtps.get(email);
        if (!entry) {
            res.status(404).json({ message: "Код не запрашивался или истёк. Запросите новый." });
            return;
        }
        if (entry.code !== body.code) {
            res.status(403).json({ message: "Неверный код" });
            return;
        }

        const result = await pool.query<{ id: string; email: string }>(
            `UPDATE "user" SET "emailVerified" = TRUE, "updatedAt" = NOW() WHERE LOWER(email) = $1 RETURNING id, email`,
            [email],
        );
        signupOtps.delete(email);
        if (!result.rows[0]) {
            res.status(404).json({ message: "Пользователь не найден" });
            return;
        }

        await writeAuditLog({
            action: "user.email.verified",
            targetUserId: result.rows[0].id,
            targetEmail: result.rows[0].email,
            metadata: { method: "signup-otp" },
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});
