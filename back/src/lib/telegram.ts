// Thin wrapper around Telegram's bot HTTP API. No webhook here on purpose — for outbound
// notifications we POST sendMessage; for the one-time link flow we poll getUpdates from
// the user's "Проверить привязку" action. Keeps dev simple (no public HTTPS needed).

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME?.trim();

export const telegramConfigured = Boolean(BOT_TOKEN);
export const telegramBotUsername = BOT_USERNAME ?? null;

function apiUrl(method: string): string {
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
    return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

// Sends a Markdown-formatted message. We swallow non-network errors (404/403 from Telegram —
// "chat not found", "bot was blocked") and log them so a single broken link doesn't break the
// caller's loop over many recipients.
export async function sendMessage(chatId: number | string, text: string): Promise<{ ok: boolean; error?: string }> {
    if (!telegramConfigured) return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };
    try {
        const response = await fetch(apiUrl("sendMessage"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "Markdown",
                link_preview_options: { is_disabled: true },
                disable_notification: false,
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.warn("[telegram] sendMessage failed", { chatId, status: response.status, body });
            return { ok: false, error: `${response.status}` };
        }
        return { ok: true };
    } catch (caught) {
        console.warn("[telegram] sendMessage network error", caught);
        return { ok: false, error: caught instanceof Error ? caught.message : "network" };
    }
}

// Telegram update payload — only the fields we touch are typed.
export type TgUpdate = {
    update_id: number;
    message?: {
        message_id: number;
        date: number;
        text?: string;
        chat: { id: number; username?: string; first_name?: string };
        from?: { id: number; username?: string; first_name?: string };
    };
};

// Polls recent updates. Telegram returns up to 100 by default and clears them after we ACK
// with offset > update_id. We pass offset=0 (no ack) when looking for /start codes — multiple
// browser tabs can race the finish-link button, so we re-read updates each time and let the
// per-user pending code expire if no message matched.
export async function getUpdates(): Promise<TgUpdate[]> {
    if (!telegramConfigured) return [];
    try {
        const response = await fetch(apiUrl("getUpdates"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ allowed_updates: ["message"], timeout: 0 }),
        });
        if (!response.ok) return [];
        const body = await response.json().catch(() => ({})) as { ok?: boolean; result?: TgUpdate[] };
        if (!body.ok || !Array.isArray(body.result)) return [];
        return body.result;
    } catch {
        return [];
    }
}
