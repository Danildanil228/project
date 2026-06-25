// Client wrappers for the Telegram-link endpoints in /api/account/telegram/*.

async function readError(response: Response): Promise<string> {
    try {
        const body = await response.json() as { message?: string };
        return body.message ?? response.statusText;
    } catch {
        return response.statusText;
    }
}

export type TelegramLinkStatus =
    | { linked: true; chatId: string; username: string | null; linkedAt: string; botUsername: string | null; configured: boolean }
    | { linked: false; botUsername: string | null; configured: boolean };

export async function getTelegramStatus(): Promise<TelegramLinkStatus | null> {
    const response = await fetch("/api/account/telegram/status", { credentials: "include" });
    if (response.status === 403 || response.status === 401) return null;
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
}

export type StartLinkResponse = { code: string; botUsername: string; deepLink: string; expiresIn: number };

export async function startTelegramLink(): Promise<StartLinkResponse> {
    const response = await fetch("/api/account/telegram/start-link", { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
}

export async function finishTelegramLink(): Promise<{ chatId: string; username: string | null }> {
    const response = await fetch("/api/account/telegram/finish-link", { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
}

export async function unlinkTelegram(): Promise<void> {
    const response = await fetch("/api/account/telegram/link", { method: "DELETE", credentials: "include" });
    if (!response.ok) throw new Error(await readError(response));
}
