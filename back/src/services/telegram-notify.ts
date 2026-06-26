// Pushes notifications to every moderator+ who has linked Telegram. Recipients = anyone with
// role admin or moderator, plus super-admin user ids. Failures per-recipient are swallowed
// (logged in sendMessage) so a single revoked chat doesn't poison the batch.

import { pool } from "../lib/db";
import { sendMessage, telegramConfigured } from "../lib/telegram";
import { superAdminUserIds } from "../lib/admin-auth";

// Public URL of the SPA — used to build clickable links in messages. Falls back to localhost
// during dev. FRONTEND_ORIGINS may be a comma-separated list; first entry wins.
export function publicSiteUrl(): string {
    const raw = process.env.FRONTEND_ORIGINS ?? "http://localhost:5173";
    return raw.split(",")[0].trim().replace(/\/$/, "");
}

export async function notifyAdmins(text: string): Promise<void> {
    if (!telegramConfigured) return;
    const { rows } = await pool.query<{ chatId: string }>(
        `
            SELECT tl."chatId"
            FROM "telegramLink" tl
            JOIN "user" u ON u.id = tl."userId"
            WHERE u.role IN ('admin', 'moderator')
               OR u.id = ANY($1::text[])
        `,
        [superAdminUserIds],
    );
    await Promise.all(rows.map((row) => sendMessage(row.chatId, text)));
}
