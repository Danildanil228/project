import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { useAuthModal } from "../context/AuthModalContext";

type AuthModalProps = { onSuccess: () => void };
type Providers = { discord?: boolean; vk?: boolean };

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Имя", "Email", "Пароль", "Код"] as const;

async function sendSignupOtp(email: string) {
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
    const [mode, setMode] = useState<"login" | "register">("login");
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
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        fetch("/api/auth-providers", { credentials: "include" })
            .then((response) => (response.ok ? response.json() : {}))
            .then((data) => setProviders(data as Providers))
            .catch(() => undefined);
    }, [open]);

    // Reset everything whenever the modal opens.
    useEffect(() => {
        if (open) {
            setMode("login");
            setStep(1);
            setDirection("forward");
            setName(""); setEmail(""); setPassword(""); setPasswordConfirm(""); setCode("");
            setError(""); setInfo(""); setBusy(false);
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

    async function handleLogin(event: React.FormEvent) {
        event.preventDefault();
        setError(""); setBusy(true);
        try {
            const result = await authClient.signIn.email({ email, password });
            if (result.error) throw new Error(result.error.message);
            onSuccess();
            setOpen(false);
        } catch (caught) {
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
            setError(caught instanceof Error ? caught.message : "Ошибка соц-входа");
        }
    }

    // Step 1 (name) → step 2 (email)
    function nextFromName() {
        if (!name.trim()) { setError("Введите имя"); return; }
        goToStep(2, "forward");
    }

    // Step 2 (email) → step 3 (password)
    function nextFromEmail() {
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Введите корректный email"); return; }
        setEmail(trimmed);
        goToStep(3, "forward");
    }

    // Step 3 (password) → signup → send OTP → step 4
    async function nextFromPassword() {
        if (password.length < 8) { setError("Пароль — минимум 8 символов"); return; }
        if (password !== passwordConfirm) { setError("Пароли не совпадают"); return; }
        setBusy(true);
        try {
            const signup = await authClient.signUp.email({ email, password, name });
            if (signup.error) throw new Error(signup.error.message ?? "Не удалось создать аккаунт");
            await sendSignupOtp(email);
            setInfo(`Код отправлен на ${email}. В dev-режиме появится в логах бэкенда.`);
            goToStep(4, "forward");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Ошибка");
        } finally {
            setBusy(false);
        }
    }

    // Step 4 (code) → confirm → auto-login → close
    async function confirmCode() {
        if (code.length !== 6) { setError("Введите 6-значный код"); return; }
        setBusy(true);
        try {
            await confirmSignupOtp(email, code);
            // Auto sign in now that the email is verified.
            const result = await authClient.signIn.email({ email, password });
            if (result.error) throw new Error(result.error.message ?? "Аккаунт подтверждён, но не получилось войти");
            onSuccess();
            setOpen(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Ошибка подтверждения");
        } finally {
            setBusy(false);
        }
    }

    async function resendCode() {
        setError(""); setInfo(""); setBusy(true);
        try {
            await sendSignupOtp(email);
            setInfo("Новый код отправлен");
        } catch (caught) {
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
                {/* Mode tabs */}
                <div className="grid grid-cols-2 border-b border-border bg-muted/40 text-sm font-bold">
                    <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className={`relative px-4 py-3 transition-colors ${mode === "login" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Вход
                        {mode === "login" && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded bg-primary" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => switchMode("register")}
                        className={`relative px-4 py-3 transition-colors ${mode === "register" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Регистрация
                        {mode === "register" && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded bg-primary" />}
                    </button>
                </div>

                {/* Body */}
                <div className="grid gap-5 p-5 sm:p-6">
                    {mode === "register" && <RegisterProgressBar step={step} />}

                    {mode === "login" ? (
                        <form className="grid gap-4" onSubmit={handleLogin}>
                            <h2 className="text-xl font-bold">С возвращением</h2>
                            <label className="grid gap-1 text-sm">
                                <span className="text-muted-foreground">Email</span>
                                <input ref={firstInputRef} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                            </label>
                            <label className="grid gap-1 text-sm">
                                <span className="text-muted-foreground">Пароль</span>
                                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                            </label>
                            {error && <p className="alert error">{error}</p>}
                            <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                                {busy && <Loader2 size={14} className="animate-spin" />}Войти
                            </button>
                        </form>
                    ) : (
                        // Re-mount on step change so the animation re-triggers.
                        <div key={`step-${step}`} className={slideIn}>
                            {step === 1 && (
                                <StepShell
                                    icon={UserIcon}
                                    title="Как вас зовут?"
                                    description="Это имя видят другие игроки в постах и комментариях."
                                    onPrimary={nextFromName}
                                    primaryLabel="Далее"
                                    busy={busy}
                                    error={error}
                                    info={info}
                                >
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Имя</span>
                                        <input ref={firstInputRef} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Иван" autoComplete="name" />
                                    </label>
                                </StepShell>
                            )}
                            {step === 2 && (
                                <StepShell
                                    icon={Mail}
                                    title="Ваш email"
                                    description="На него придёт 6-значный код для подтверждения."
                                    onBack={() => goToStep(1, "backward")}
                                    onPrimary={nextFromEmail}
                                    primaryLabel="Далее"
                                    busy={busy}
                                    error={error}
                                    info={info}
                                >
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Email</span>
                                        <input ref={firstInputRef} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ivan@example.com" autoComplete="email" />
                                    </label>
                                </StepShell>
                            )}
                            {step === 3 && (
                                <StepShell
                                    icon={ShieldCheck}
                                    title="Придумайте пароль"
                                    description="Минимум 8 символов. Используйте буквы, цифры и хотя бы один спецсимвол."
                                    onBack={() => goToStep(2, "backward")}
                                    onPrimary={nextFromPassword}
                                    primaryLabel={busy ? "Отправляем код…" : "Создать аккаунт"}
                                    busy={busy}
                                    error={error}
                                    info={info}
                                >
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
                                <StepShell
                                    icon={CheckCircle2}
                                    title="Введите код"
                                    description={`Мы отправили 6-значный код на ${email}.`}
                                    onBack={() => goToStep(3, "backward")}
                                    onPrimary={confirmCode}
                                    primaryLabel="Подтвердить"
                                    busy={busy}
                                    error={error}
                                    info={info}
                                    extra={
                                        <button type="button" onClick={resendCode} disabled={busy} className="text-xs text-primary hover:underline disabled:opacity-50">
                                            Отправить код ещё раз
                                        </button>
                                    }
                                >
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-muted-foreground">Код</span>
                                        <input
                                            ref={firstInputRef}
                                            inputMode="numeric"
                                            pattern="[0-9]{6}"
                                            maxLength={6}
                                            value={code}
                                            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                                            autoComplete="one-time-code"
                                            placeholder="123456"
                                            className="text-center text-2xl font-bold tracking-[0.4em]"
                                        />
                                    </label>
                                </StepShell>
                            )}
                        </div>
                    )}

                    {/* Social providers — login mode only */}
                    {mode === "login" && (providers.discord || providers.vk) && (
                        <div className="grid gap-2">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                                <span className="h-px flex-1 bg-border" />
                                или
                                <span className="h-px flex-1 bg-border" />
                            </div>
                            {providers.discord && <button type="button" onClick={() => handleSocial("discord")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary">Войти через Discord</button>}
                            {providers.vk && <button type="button" onClick={() => handleSocial("vk")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary">Войти через VK</button>}
                        </div>
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
            {/* Step dots — filled / current / empty */}
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
    onPrimary: () => void;
    primaryLabel: string;
    busy: boolean;
    error: string;
    info: string;
    children: React.ReactNode;
    extra?: React.ReactNode;
};

function StepShell({ icon: Icon, title, description, onBack, onPrimary, primaryLabel, busy, error, info, children, extra }: StepShellProps) {
    return (
        <form
            className="grid gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                if (!busy) onPrimary();
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
                    type="submit"
                    disabled={busy}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:flex-none"
                >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    {primaryLabel}
                    {!busy && <ArrowRight size={14} />}
                </button>
            </div>

            {extra && <div className="text-center">{extra}</div>}
        </form>
    );
}
