import { useState } from "react";
import { reportPost } from "../lib/engagement-api";
import type { ManagedUser } from "../types/admin";
import { getErrorMessage } from "../utils/admin-format";

type ReportButtonProps = {
    postId: number;
    currentUser?: ManagedUser;
    onOpenAuthModal: () => void;
};

const presetReasons = ["Спам или реклама", "Оскорбления", "Недостоверная информация", "Запрещённый контент"];

export function ReportButton({ postId, currentUser, onOpenAuthModal }: ReportButtonProps) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [customReason, setCustomReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    function start() {
        if (!currentUser) {
            onOpenAuthModal();
            return;
        }
        setOpen(true);
        setError("");
        setReason("");
        setCustomReason("");
    }

    async function submit() {
        const finalReason = (reason === "__custom__" ? customReason : reason).trim();
        if (!finalReason) {
            setError("Выберите или укажите причину");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await reportPost(postId, finalReason);
            setOpen(false);
            setDone(true);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    if (done) {
        return <span className="text-xs text-muted-foreground">Жалоба отправлена — спасибо</span>;
    }

    if (!open) {
        return (
            <button type="button" onClick={start} className="text-xs text-muted-foreground hover:text-destructive">
                ⚐ Пожаловаться
            </button>
        );
    }

    return (
        <div className="grid gap-2 rounded-lg border border-border bg-card p-3 text-sm">
            <span className="font-bold">Пожаловаться на пост</span>
            {error && <span className="text-xs text-destructive">{error}</span>}
            <div className="grid gap-1">
                {presetReasons.map((preset) => (
                    <label key={preset} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name={`report-${postId}`} className="shrink-0" checked={reason === preset} onChange={() => setReason(preset)} />
                        <span>{preset}</span>
                    </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name={`report-${postId}`} className="shrink-0" checked={reason === "__custom__"} onChange={() => setReason("__custom__")} />
                    <span>Другое</span>
                </label>
                {reason === "__custom__" && (
                    <input value={customReason} onChange={(event) => setCustomReason(event.target.value)} maxLength={500} placeholder="Опишите причину" />
                )}
            </div>
            <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-50">
                    Отправить жалобу
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold">
                    Отмена
                </button>
            </div>
        </div>
    );
}
