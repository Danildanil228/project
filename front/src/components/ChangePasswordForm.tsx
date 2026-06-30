import { useEffect, useState } from "react";
import { confirmPasswordChange, getPasswordChangePending, hasPasswordCredential, requestPasswordChange } from "../lib/account-api";
import { Skeleton } from "./LoadingState";

// Two-step password change for the signed-in user.
// Step 1 — submit current + new password → server emails (or logs to console) a 6-digit code.
// Step 2 — submit the code → server applies the change.
// Hidden entirely when the account has no password credential (OAuth-only sign-in).
export function ChangePasswordForm() {
    const [hasPassword, setHasPassword] = useState<boolean | null>(null);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [code, setCode] = useState("");
    const [stage, setStage] = useState<"input" | "verify">("input");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        hasPasswordCredential().then((value) => {
            if (cancelled) return;
            setHasPassword(value);
            // If we're a credential user, check whether the previous tab/session left a
            // pending code request alive — if so, jump straight to the code step instead
            // of forcing the user to re-enter the old/new password.
            if (value) {
                getPasswordChangePending().then((status) => {
                    if (cancelled) return;
                    if (status.pending) setStage("verify");
                }).catch(() => undefined);
            }
        }).catch(() => { if (!cancelled) setHasPassword(false); });
        return () => { cancelled = true; };
    }, []);

    if (hasPassword === null) {
        return <section className="subsection grid gap-3" aria-busy="true"><Skeleton className="h-5 w-36" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-10 w-32" /></section>;
    }
    if (!hasPassword) return null; // OAuth-only — no password to change.

    async function onRequest(event: React.FormEvent) {
        event.preventDefault();
        setMessage(null);
        if (newPassword.length < 8) {
            setMessage({ tone: "error", text: "Новый пароль — минимум 8 символов" });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ tone: "error", text: "Пароли не совпадают" });
            return;
        }
        setBusy(true);
        try {
            await requestPasswordChange(currentPassword, newPassword);
            setStage("verify");
            setMessage({ tone: "success", text: "Код отправлен. Проверьте email (в dev — стандартный вывод сервера)." });
        } catch (caught) {
            setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Не удалось запросить смену" });
        } finally {
            setBusy(false);
        }
    }

    async function onConfirm(event: React.FormEvent) {
        event.preventDefault();
        setMessage(null);
        setBusy(true);
        try {
            await confirmPasswordChange(code);
            setStage("input");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setCode("");
            setMessage({ tone: "success", text: "Пароль изменён" });
        } catch (caught) {
            setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Не удалось подтвердить" });
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="subsection">
            <h3>Смена пароля</h3>
            {stage === "input" ? (
                <form onSubmit={onRequest} className="stack">
                    <label>
                        Текущий пароль
                        <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                    </label>
                    <label>
                        Новый пароль
                        <input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    </label>
                    <label>
                        Повтор нового пароля
                        <input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </label>
                    <button className="primary" type="submit" disabled={busy || !currentPassword || !newPassword}>
                        Запросить код
                    </button>
                </form>
            ) : (
                <form onSubmit={onConfirm} className="stack">
                    <p className="muted">Код выслан на email. Введите 6-значный код ниже.</p>
                    <label>
                        Код подтверждения
                        <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
                    </label>
                    <div className="actions-row">
                        <button className="primary" type="submit" disabled={busy || code.length !== 6}>
                            Подтвердить смену
                        </button>
                        <button className="secondary" type="button" onClick={() => { setStage("input"); setCode(""); setMessage(null); }}>
                            Отмена
                        </button>
                    </div>
                </form>
            )}
            {message && (
                <p className={`alert ${message.tone === "success" ? "success" : "error"}`}>{message.text}</p>
            )}
        </section>
    );
}
