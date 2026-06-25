import { useEffect, useState } from "react";
import { Bell, ExternalLink, Loader2, Send, Unlink } from "lucide-react";
import {
    finishTelegramLink,
    getTelegramStatus,
    startTelegramLink,
    unlinkTelegram,
    type StartLinkResponse,
    type TelegramLinkStatus,
} from "../lib/telegram-api";
import { getErrorMessage } from "../utils/admin-format";

// Settings card for hooking up Telegram push notifications. Only relevant to mod+ accounts —
// the backend itself returns 403 to non-elevated users, and this component hides itself when
// it sees that. So the parent can always render it; it self-gates.
export function TelegramLinkPanel() {
    const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState<StartLinkResponse | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function refresh() {
        setError("");
        try {
            const result = await getTelegramStatus();
            setStatus(result);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void refresh(); }, []);

    async function start() {
        setBusy(true); setError(""); setNotice("");
        try {
            const response = await startTelegramLink();
            setPending(response);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    async function finish() {
        setBusy(true); setError("");
        try {
            const result = await finishTelegramLink();
            setNotice(result.username ? `Привязан как @${result.username}` : "Привязано");
            setPending(null);
            await refresh();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    async function unlink() {
        if (!window.confirm("Отвязать Telegram? Уведомления перестанут приходить.")) return;
        setBusy(true); setError("");
        try {
            await unlinkTelegram();
            setNotice("Telegram отвязан");
            await refresh();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    // Hide entirely for non-mod+ users (the API returned 403 → status === null).
    if (loading) return null;
    if (!status) return null;

    if (!status.configured) {
        return (
            <section className="subsection">
                <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><Send size={18} /></span>
                    <div>
                        <h3>Telegram-уведомления</h3>
                        <p className="muted text-sm">Бот не настроен на сервере — задайте TELEGRAM_BOT_TOKEN в окружении.</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="subsection grid gap-3">
            <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Bell size={18} /></span>
                <div className="grid">
                    <h3 className="text-base font-bold">Telegram-уведомления</h3>
                    <p className="text-xs text-muted-foreground">Получайте сообщение в Telegram, когда появляется новый пост на модерации или жалоба.</p>
                </div>
            </div>

            {notice && <p className="alert success text-xs">{notice}</p>}
            {error && <p className="alert error text-xs">{error}</p>}

            {status.linked ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="grid gap-0.5">
                        <strong>Привязан{status.username ? ` как @${status.username}` : ""}</strong>
                        <span className="text-xs text-muted-foreground">chat #{status.chatId} · с {new Date(status.linkedAt).toLocaleDateString("ru-RU")}</span>
                    </div>
                    <button type="button" onClick={unlink} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />} Отвязать
                    </button>
                </div>
            ) : pending ? (
                <div className="grid gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                    <p>1. Откройте бота в Telegram и отправьте код:</p>
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 font-mono text-2xl font-bold tracking-[0.3em]">
                        <span>{pending.code}</span>
                        <a
                            href={pending.deepLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                        >
                            <ExternalLink size={12} /> Открыть бота
                        </a>
                    </div>
                    <p className="text-xs text-muted-foreground">2. Когда отправили — нажмите «Проверить».</p>
                    <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => setPending(null)} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary disabled:opacity-50">
                            Отмена
                        </button>
                        <button type="button" onClick={finish} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                            {busy && <Loader2 size={12} className="animate-spin" />}Проверить привязку
                        </button>
                    </div>
                </div>
            ) : (
                <button type="button" onClick={start} disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    {busy && <Loader2 size={14} className="animate-spin" />} Привязать Telegram
                </button>
            )}
        </section>
    );
}
