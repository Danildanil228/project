import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { useAuthModal } from "../context/AuthModalContext";

type AuthModalProps = { onSuccess: () => void };
type Providers = { discord?: boolean; vk?: boolean };

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Имя", "Email", "Пароль", "Код"] as const;
// localStorage key for restoring the code-entry step after a page reload. Stores ONLY the email
// and an absolute expiry timestamp — never the password or the code itself. The backend's
// /email-verify/pending check is the real source of truth; localStorage just tells us which
// email to ask about.
const PENDING_KEY = "signup-otp-pending";
const PENDING_TTL_MS = 10 * 60 * 1000;

function savePendingEmail(email: string) {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify({ email, expiresAt: Date.now() + PENDING_TTL_MS }));
    } catch { /* ignore quota errors */ }
}
function readPendingEmail(): string | null {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { email?: string; expiresAt?: number };
        if (!parsed.email || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
        return parsed.email;
    } catch { return null; }
}
function clearPendingEmail() {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

type PendingStatus = { pending: boolean; resendInSeconds: number };
async function checkPending(email: string): Promise<PendingStatus> {
    try {
        const response = await fetch(`/api/account/email-verify/pending?email=${encodeURIComponent(email)}`, { credentials: "include" });
        if (!response.ok) return { pending: false, resendInSeconds: 0 };
        const data = await response.json() as { pending?: boolean; resendInSeconds?: number };
        return { pending: Boolean(data.pending), resendInSeconds: Math.max(0, Number(data.resendInSeconds ?? 0)) };
    } catch { return { pending: false, resendInSeconds: 0 }; }
}

// Returns the throttle seconds the backend reports back, so the UI can disable the
// "Отправить ещё раз" button for exactly the same window the server enforces.
async function checkEmailAvailable(email: string): Promise<boolean> {
    const response = await fetch(`/api/account/email-available?email=${encodeURIComponent(email)}`, { credentials: "include" });
    if (!response.ok) throw new Error("Не удалось проверить email");
    const data = await response.json() as { available?: boolean };
    return Boolean(data.available);
}

async function sendSignupOtp(email: string): Promise<number> {
    const response = await fetch("/api/account/email-verify/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Не удалось отправить код");
    }
    const data = await response.json().catch(() => ({})) as { resendInSeconds?: number };
    return Math.max(0, Number(data.resendInSeconds ?? 0));
}

async function confirmSignupOtp(email: string, code: string) {
    const response = await fetch("/api/account/email-verify/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Неверный код");
    }
}

export function AuthModal({ onSuccess }: AuthModalProps) {
    const { open, setOpen } = useAuthModal();
    // `forgot` is a single-screen sub-mode of login — typing the email and pressing
    // "Отправить ссылку" triggers better-auth's password-reset email and switches back to login.
    const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
    const [forgotInfo, setForgotInfo] = useState("");
    const [step, setStep] = useState(1);
    const [direction, setDirection] = useState<"forward" | "backward">("forward");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [code, setCode] = useState("");

    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [busy, setBusy] = useState(false);
    const [providers, setProviders] = useState<Providers>({});
    // Seconds remaining until "Отправить ещё раз" becomes available again. The backend reports
    // this when we send/resend the OTP and when we check pending state on mount.
    const [resendIn, setResendIn] = useState(0);
    const firstInputRef = useRef<HTMLInputElement>(null);

    // Restore the code-entry step on mount when a pending OTP is still alive on the backend.
    // No password is restored, so after confirming the code we send the user back to login
    // (email pre-filled) rather than auto-signing them in.
    useEffect(() => {
        if (!open) return;
        const pendingEmail = readPendingEmail();
        if (!pendingEmail) return;
        let cancelled = false;
        checkPending(pendingEmail).then((status) => {
            if (cancelled || !status.pending) return;
            setMode("register");
            setEmail(pendingEmail);
            setStep(4);
            setDirection("forward");
            setResendIn(status.resendInSeconds);
            setInfo(`Введите код, отправленный на ${pendingEmail}.`);
        });
        return () => { cancelled = true; };
    }, [open]);

    // Tick the resend countdown each second while step 4 is open and the timer is running.
    // Stops at 0 — when it hits zero the button re-enables. setTimeout instead of setInterval
    // so we never schedule overlapping ticks.
    useEffect(() => {
        if (resendIn <= 0) return;
        const id = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
        return () => window.clearTimeout(id);
    }, [resendIn]);

    useEffect(() => {
        if (!open) return;
        fetch("/api/auth-providers", { credentials: "include" })
            .then((response) => (response.ok ? response.json() : {}))
            .then((data) => setProviders(data as Providers))
            .catch(() => undefined);
    }, [open]);

    // Reset transient fields when the modal opens — but only ones that aren't restored above.
    useEffect(() => {
        if (open) {
            setError("");
            setBusy(false);
            setPassword("");
            setPasswordConfirm("");
            setCode("");
        }
    }, [open]);

    // Autofocus the first input of each step.
    useEffect(() => {
        if (!open) return;
        const id = window.setTimeout(() => firstInputRef.current?.focus(), 60);
        return () => window.clearTimeout(id);
    }, [open, mode, step]);

    if (!open) return null;

    function switchMode(next: "login" | "register") {
        setMode(next);
        setStep(1);
        setDirection("forward");
        setError(""); setInfo("");
    }

    function goToStep(next: number, dir: "forward" | "backward") {
        if (next < 1 || next > TOTAL_STEPS) return;
        setDirection(dir);
        setStep(next);
        setError(""); setInfo("");
    }

    async function handleLogin() {
        setError(""); setBusy(true);
        try {
            const result = await authClient.signIn.email({ email, password });
            if (result.error) throw new Error(result.error.message);
            onSuccess();
            setOpen(false);
        } catch (caught) {
            console.error("[auth] login failed", caught);
            setError(caught instanceof Error ? caught.message : "Ошибка");
        } finally {
            setBusy(false);
        }
    }

    async function sendResetLink() {
        const trimmed = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Введите корректный email"); return; }
        setEmail(trimmed);
        setError(""); setBusy(true);
        try {
            const result = await authClient.requestPasswordReset({
                email: trimmed,
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if ("error" in result && result.error) throw new Error(result.error.message ?? "Не удалось отправить");
            setForgotInfo(`Если ${trimmed} есть в базе — на него отправлена ссылка для сброса. В dev-режиме появится в логах бэкенда.`);
        } catch (caught) {
            console.error("[auth] forgot-password failed", caught);
            setError(caught instanceof Error ? caught.message : "Ошибка");
        } finally {
            setBusy(false);
        }
    }

    async function handleSocial(provider: "discord" | "vk") {
        setError("");
        try {
            const callbackURL = `${window.location.origin}/`;
            const result = await authClient.signIn.social({ provider, callbackURL });
            if ("error" in result && result.error) throw new Error(result.error.message ?? "Ошибка соц-входа");
        } catch (caught) {
            console.error("[auth] social failed", caught);
            setError(caught instanceof Error ? caught.message : "Ошибка соц-входа");
        }
    }

    function nextFromName() {
        if (!name.trim()) { setError("Введите имя"); return; }
        goToStep(2, "forward");
    }

    async function nextFromEmail() {
        const trimmed = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Введите корректный email"); return; }
        setEmail(trimmed);
        setBusy(true); setError("");
        try {
            const available = await checkEmailAvailable(trimmed);
            if (!available) {
                setError("Этот email уже зарегистрирован. Войдите или восстановите пароль.");
                return;
            }
            goToStep(3, "forward");
        } catch (caught) {
            console.error("[auth] email-check failed", caught);
            setError(caught instanceof Error ? caught.message : "Не удалось проверить email");
        } finally {
            setBusy(false);
        }
    }

    // Step 3 (password) → signup → send OTP → step 4. The `try` wraps both the better-auth
    // signUpEmail and our OTP send; either failing leaves the user on step 3 with an error,
    // never on a half-applied state.
    async function nextFromPassword() {
        if (password.length < 8) { setError("Пароль — минимум 8 символов"); return; }
        if (password !== passwordConfirm) { setError("Пароли не совпадают"); return; }
        setBusy(true); setError(""); setInfo("");
        try {
            const signup = await authClient.signUp.email({ email, password, name });
            // better-auth: success → { data: {...}, error: null }; failure → { data: null, error: {...} }
            if (signup.error) throw new Error(signup.error.message ?? "Не удалось создать аккаунт");
            const resendInSeconds = await sendSignupOtp(email);
            savePendingEmail(email);
            setResendIn(resendInSeconds);
            setInfo(`Код отправлен на ${email}. В dev-режиме появится в логах бэкенда.`);
            goToStep(4, "forward");
        } catch (caught) {
            console.error("[auth] signup step failed", caught);
            setError(caught instanceof Error ? caught.message : "Ошибка");
        } finally {
            setBusy(false);
        }
    }

    // Step 4 (code) — confirm + auto sign-in if we still have the password in memory.
    // After a page reload `password` is empty, so we fall back to "Email подтверждён, теперь войдите"
    // and leave the user on the login screen with the email pre-filled.
    async function confirmCode() {
        if (code.length !== 6) { setError("Введите 6-значный код"); return; }
        setBusy(true); setError("");
        try {
            await confirmSignupOtp(email, code);
            clearPendingEmail();
            if (password) {
                const result = await authClient.signIn.email({ email, password });
                if (result.error) throw new Error(result.error.message ?? "Подтверждено, но не получилось войти");
                onSuccess();
                setOpen(false);
                return;
            }
            // Reload path: no password in memory. Drop into login mode with email pre-filled.
            setMode("login");
            setStep(1);
            setCode("");
            setInfo("Email подтверждён. Войдите паролем.");
        } catch (caught) {
            console.error("[auth] confirm failed", caught);
            setError(caught instanceof Error ? caught.message : "Ошибка подтверждения");
        } finally {
            setBusy(false);
        }
    }

    async function resendCode() {
        if (resendIn > 0) return;
        setError(""); setInfo(""); setBusy(true);
        try {
            const resendInSeconds = await sendSignupOtp(email);
            savePendingEmail(email);
            setResendIn(resendInSeconds);
            setInfo("Новый код отправлен");
        } catch (caught) {
            console.error("[auth] resend failed", caught);
            setError(caught instanceof Error ? caught.message : "Не удалось отправить");
        } finally {
            setBusy(false);
        }
    }

    const slideIn = direction === "forward" ? "animate-in slide-in-from-right-6 fade-in duration-300" : "animate-in slide-in-from-left-6 fade-in duration-300";

    return (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div
                className="relative grid w-full max-w-md gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="grid gap-5 p-5 sm:p-6">
                    {mode === "register" && <RegisterProgressBar step={step} />}

                    {mode === "login" ? (
                        <div
                            className="grid gap-4"
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT" && !busy) {
                                    event.preventDefault();
                                    void handleLogin();
                                }
                            }}
                        >
                            <h2 className="text-xl font-bold">Вход</h2>
                            <label className="grid gap-1 text-sm">
                                <span className="text-muted-foreground">Email</span>
                                <input ref={firstInputRef} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                            </label>
                            <label className="grid gap-1 text-sm">
                                <span className="text-muted-foreground">Пароль</span>
                                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                            </label>
                            {info && <p className="alert success text-xs">{info}</p>}
                            {error && <p className="alert error text-xs">{error}</p>}
                            <button type="button" onClick={handleLogin} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                                {busy && <Loader2 size={14} className="animate-spin" />}Войти
                            </button>
                        </div>
                    ) : mode === "forgot" ? (
                        <div
                            className="grid gap-4"
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT" && !busy) {
                                    event.preventDefault();
                                    void sendResetLink();
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Mail size={18} /></span>
                                <div className="grid">
                                    <h2 className="text-lg font-bold">Восстановление пароля</h2>
                                    <p className="text-xs text-muted-foreground">Введите ваш email — пришлём ссылку для сброса.</p>
                                </div>
                            </div>
                            <label className="grid gap-1 text-sm">
                                <span className="text-muted-foreground">Email</span>
                                <input ref={firstInputRef} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                            </label>
                            {forgotInfo && <p className="alert success text-xs">{forgotInfo}</p>}
                            {error && <p className="alert error text-xs">{error}</p>}
                            <div className="flex items-center justify-between gap-2">
                                <button type="button" onClick={() => { setMode("login"); setForgotInfo(""); setError(""); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50">
                                    <ArrowLeft size={14} /> Назад
                                </button>
                                <button type="button" onClick={sendResetLink} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:flex-none">
                                    {busy && <Loader2 size={14} className="animate-spin" />}Отправить ссылку
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div key={`step-${step}`} className={slideIn}>
                            {step === 1 && (
                                <StepShell icon={UserIcon} title="Как вас зовут?" description="Это имя видят другие игроки в постах и комментариях." onPrimary={nextFromName} primaryLabel="Далее" busy={busy} error={error} info={info}>
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Имя</span>
                                        <input ref={firstInputRef} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Иван" autoComplete="name" />
                                    </label>
                                </StepShell>
                            )}
                            {step === 2 && (
                                <StepShell icon={Mail} title="Ваш email" description="На него придёт 6-значный код для подтверждения." onBack={() => goToStep(1, "backward")} onPrimary={nextFromEmail} primaryLabel="Далее" busy={busy} error={error} info={info}>
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Email</span>
                                        <input ref={firstInputRef} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ivan@example.com" autoComplete="email" />
                                    </label>
                                </StepShell>
                            )}
                            {step === 3 && (
                                <StepShell icon={ShieldCheck} title="Придумайте пароль" description="Минимум 8 символов." onBack={() => goToStep(2, "backward")} onPrimary={nextFromPassword} primaryLabel={busy ? "Создаём аккаунт…" : "Создать аккаунт"} busy={busy} error={error} info={info}>
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Пароль</span>
                                        <input ref={firstInputRef} type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" />
                                    </label>
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Повтор пароля</span>
                                        <input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} minLength={8} autoComplete="new-password" />
                                    </label>
                                </StepShell>
                            )}
                            {step === 4 && (
                                <StepShell icon={CheckCircle2} title="Введите код" description={`Мы отправили 6-значный код на ${email}.`} onBack={() => goToStep(3, "backward")} onPrimary={confirmCode} primaryLabel="Подтвердить" busy={busy} error={error} info={info}
                                    extra={
                                        <button
                                            type="button"
                                            onClick={resendCode}
                                            disabled={busy || resendIn > 0}
                                            // Disabled+cursor change make the throttle obvious even before reading the label.
                                            className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                                        >
                                            {resendIn > 0 ? `Отправить код ещё раз (${resendIn})` : "Отправить код ещё раз"}
                                        </button>
                                    }
                                >
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Код</span>
                                        <input ref={firstInputRef} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" placeholder="123456" className="text-center text-2xl font-bold tracking-[0.4em]" />
                                    </label>
                                </StepShell>
                            )}
                        </div>
                    )}

                    {/* Social providers + bottom toggle live in BOTH modes — toggle text changes */}
                    {(providers.discord || providers.vk) && mode === "login" && (
                        <div className="grid gap-2">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                                <span className="h-px flex-1 bg-border" />или<span className="h-px flex-1 bg-border" />
                            </div>
                            {providers.discord && <button type="button" onClick={() => handleSocial("discord")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary">Войти через Discord</button>}
                            {providers.vk && <button type="button" onClick={() => handleSocial("vk")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary">Войти через VK</button>}
                        </div>
                    )}

                    {/* Bottom mode toggles. Login shows two (forgot + register), register shows one (login),
                        forgot shows none (the inline "Назад" button covers it). */}
                    {mode === "login" && (
                        <div className="grid gap-1 text-center text-sm">
                            <button type="button" onClick={() => { setMode("forgot"); setError(""); setForgotInfo(""); }} className="text-primary hover:underline">
                                Забыли пароль?
                            </button>
                            <button type="button" onClick={() => switchMode("register")} className="text-primary hover:underline">
                                Нет аккаунта? Регистрация
                            </button>
                        </div>
                    )}
                    {mode === "register" && (
                        <button type="button" onClick={() => switchMode("login")} className="text-center text-sm text-primary hover:underline">
                            Уже есть аккаунт? Войти
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function RegisterProgressBar({ step }: { step: number }) {
    const percent = useMemo(() => Math.round((step / TOTAL_STEPS) * 100), [step]);
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                <span>Шаг {step} из {TOTAL_STEPS}</span>
                <span>{STEP_LABELS[step - 1]}</span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <div className="flex items-center justify-between px-0.5">
                {STEP_LABELS.map((label, index) => {
                    const n = index + 1;
                    const state = n < step ? "done" : n === step ? "current" : "todo";
                    return (
                        <div key={label} className="flex items-center gap-1.5">
                            <span
                                className={`grid size-5 place-items-center rounded-full text-[10px] font-bold transition-colors ${
                                    state === "done"
                                        ? "bg-primary text-primary-foreground"
                                        : state === "current"
                                            ? "bg-accent text-accent-foreground ring-2 ring-accent/30"
                                            : "border border-border bg-card text-muted-foreground"
                                }`}
                            >
                                {state === "done" ? "✓" : n}
                            </span>
                            <span className={`hidden text-[10px] font-semibold uppercase tracking-wider sm:inline ${state === "todo" ? "text-muted-foreground" : "text-foreground"}`}>{label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

type StepShellProps = {
    icon: typeof UserIcon;
    title: string;
    description: string;
    onBack?: () => void;
    onPrimary: () => void | Promise<void>;
    primaryLabel: string;
    busy: boolean;
    error: string;
    info: string;
    children: React.ReactNode;
    extra?: React.ReactNode;
};

function StepShell({ icon: Icon, title, description, onBack, onPrimary, primaryLabel, busy, error, info, children, extra }: StepShellProps) {
    // No <form> here on purpose — submit-events have a default action that reloads the page,
    // and any combination of stray autocomplete + preventDefault edge-cases proved fragile.
    // Plain div + explicit button.onClick is bullet-proof. Enter-to-advance is implemented by
    // a single onKeyDown on the wrapper that calls primary when the focused element is an input.
    function triggerPrimary() {
        if (busy) return;
        Promise.resolve(onPrimary()).catch((caught) => {
            console.error("[auth] step primary failed", caught);
        });
    }
    return (
        <div
            className="grid gap-4"
            onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const target = event.target as HTMLElement;
                if (target.tagName !== "INPUT") return;
                event.preventDefault();
                triggerPrimary();
            }}
        >
            <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon size={18} />
                </span>
                <div className="grid">
                    <h2 className="text-lg font-bold">{title}</h2>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>

            <div className="grid gap-3">{children}</div>

            {info && <p className="alert success text-xs">{info}</p>}
            {error && <p className="alert error text-xs">{error}</p>}

            <div className="flex items-center justify-between gap-2">
                {onBack ? (
                    <button type="button" onClick={onBack} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50">
                        <ArrowLeft size={14} /> Назад
                    </button>
                ) : <span />}
                <button
                    type="button"
                    onClick={triggerPrimary}
                    disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:flex-none"
                >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    {primaryLabel}
                    {!busy && <ArrowRight size={14} />}
                </button>
            </div>

            {extra && <div className="text-center">{extra}</div>}
        </div>
    );
}
