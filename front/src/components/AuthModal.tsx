import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import { useAuthModal } from "../context/AuthModalContext";

type AuthModalProps = {
    onSuccess: () => void;
};

type Providers = { discord?: boolean; vk?: boolean };

export function AuthModal({ onSuccess }: AuthModalProps) {
    const { open, setOpen } = useAuthModal();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    // After signup we switch into a dedicated "check your email" screen so the user can't miss it.
    const [signupSuccessEmail, setSignupSuccessEmail] = useState("");
    const [providers, setProviders] = useState<Providers>({});

    useEffect(() => {
        if (!open) return;
        fetch("/api/auth-providers", { credentials: "include" })
            .then((response) => (response.ok ? response.json() : {}))
            .then((data) => setProviders(data as Providers))
            .catch(() => undefined);
    }, [open]);

    const handleSocial = async (provider: "discord" | "vk") => {
        setError("");
        try {
            // Absolute URL: better-auth resolves a relative path against BETTER_AUTH_URL (the backend),
            // which would land the user on an empty page on the API host instead of the SPA.
            const callbackURL = `${window.location.origin}/`;
            const result = await authClient.signIn.social({ provider, callbackURL });
            if ("error" in result && result.error) throw new Error(result.error.message ?? "Ошибка соц-входа");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка соц-входа");
        }
    };

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            if (isLogin) {
                const result = await authClient.signIn.email({ email, password });
                if (result.error) throw new Error(result.error.message);
                onSuccess();
                setOpen(false);
            } else {
                const result = await authClient.signUp.email({ email, password, name });
                if (result.error) throw new Error(result.error.message);
                // Persist the email in dedicated state so we render a full "check your email" screen.
                setSignupSuccessEmail(email);
                setPassword("");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка");
        }
    };

    function backToLogin() {
        setSignupSuccessEmail("");
        setIsLogin(true);
        setError("");
    }

    if (signupSuccessEmail) {
        return (
            <div className="modal-backdrop" onClick={() => setOpen(false)}>
                <div className="auth-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
                    <div style={{ textAlign: "center", padding: "8px 0" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📬</div>
                        <h2 style={{ margin: "0 0 12px" }}>Проверьте почту</h2>
                        <p style={{ margin: "0 0 8px", lineHeight: 1.5 }}>
                            Аккаунт создан. Мы отправили письмо с подтверждением на адрес <strong>{signupSuccessEmail}</strong>.
                        </p>
                        <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
                            Пройдите по ссылке из письма, чтобы завершить регистрацию, затем войдите.
                            <br />
                            <em style={{ fontSize: 12 }}>(В dev-режиме ссылка появится в консоли бэкенда.)</em>
                        </p>
                    </div>
                    <div className="stack" style={{ gap: 8 }}>
                        <button className="primary" type="button" onClick={backToLogin}>
                            Перейти ко входу
                        </button>
                        <button className="link-button" type="button" onClick={() => setOpen(false)}>
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="auth-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
                <h2>{isLogin ? "Вход" : "Регистрация"}</h2>
                <form className="stack" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <label>
                            Имя
                            <input value={name} onChange={(e) => setName(e.target.value)} required />
                        </label>
                    )}
                    <label>
                        Email
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </label>
                    <label>
                        Пароль
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                    </label>
                    {error && <p className="alert error">{error}</p>}
                    <button className="primary" type="submit">
                        {isLogin ? "Войти" : "Создать аккаунт"}
                    </button>
                </form>
                {(providers.discord || providers.vk) && (
                    <div className="stack" style={{ marginTop: 12, gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12 }}>
                            <span style={{ flex: 1, height: 1, background: "#cbd5e1" }} />
                            или
                            <span style={{ flex: 1, height: 1, background: "#cbd5e1" }} />
                        </div>
                        {providers.discord && (
                            <button type="button" className="secondary" onClick={() => handleSocial("discord")}>
                                Войти через Discord
                            </button>
                        )}
                        {providers.vk && (
                            <button type="button" className="secondary" onClick={() => handleSocial("vk")}>
                                Войти через VK
                            </button>
                        )}
                    </div>
                )}
                <button className="link-button" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
                </button>
            </div>
        </div>
    );
}
