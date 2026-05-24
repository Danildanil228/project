import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../lib/auth-api";
import { authClient } from "../lib/auth-client";
import { getErrorMessage } from "../utils/admin-format";
import { unwrapAuthResult } from "../utils/auth-client-result";

type AuthPageProps = {
    onAuthenticated: () => Promise<void>;
};

export function AuthPage({ onAuthenticated }: AuthPageProps) {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isLogin, setIsLogin] = useState(true);
    const [isResetMode, setIsResetMode] = useState(false);
    const [authError, setAuthError] = useState("");
    const [notice, setNotice] = useState("");

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setAuthError("");
        setNotice("");

        if (isResetMode) {
            try {
                await unwrapAuthResult(
                    authApi.requestPasswordReset({
                        email,
                        redirectTo: `${window.location.origin}/reset-password`,
                    }),
                );
                setNotice("Если такой email есть в системе, ссылка восстановления отправлена. В dev-режиме она появится в консоли бэкенда.");
            } catch (error) {
                setAuthError(getErrorMessage(error));
            }
            return;
        }

        const result = isLogin
            ? await authClient.signIn.email({ email, password })
            : await authClient.signUp.email({ email, password, name });

        if (result.error) {
            setAuthError(result.error.message || "Ошибка авторизации");
            return;
        }

        await onAuthenticated();
        navigate("/", { replace: true });
    }

    return (
        <main className="auth-page">
            <section className="auth-panel">
                <div>
                    <p className="eyebrow">Better Auth</p>
                    <h1>{isResetMode ? "Восстановление пароля" : isLogin ? "Вход" : "Регистрация"}</h1>
                    <p className="muted">
                        {isResetMode
                            ? "Введите email, и система подготовит ссылку для сброса пароля."
                            : "После входа откроется главная страница. Доступ к админке проверяется на сервере."}
                    </p>
                </div>

                <form className="stack" onSubmit={handleSubmit}>
                    {!isLogin && !isResetMode && (
                        <label>
                            Имя
                            <input value={name} onChange={(event) => setName(event.target.value)} required />
                        </label>
                    )}

                    <label>
                        Email
                        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                    </label>

                    {!isResetMode && (
                        <label>
                            Пароль
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                minLength={8}
                                required
                            />
                        </label>
                    )}

                    {notice && <p className="alert success">{notice}</p>}
                    {authError && <p className="alert error">{authError}</p>}

                    <button className="primary" type="submit">
                        {isResetMode ? "Отправить ссылку" : isLogin ? "Войти" : "Создать аккаунт"}
                    </button>
                </form>

                <div className="auth-links">
                    <button
                        className="link-button"
                        onClick={() => {
                            setIsResetMode(false);
                            setIsLogin((value) => !value);
                            setAuthError("");
                            setNotice("");
                        }}
                    >
                        {isLogin ? "Нет аккаунта? Зарегистрироваться" : "Есть аккаунт? Войти"}
                    </button>
                    <button
                        className="link-button"
                        onClick={() => {
                            setIsResetMode((value) => !value);
                            setIsLogin(true);
                            setAuthError("");
                            setNotice("");
                        }}
                    >
                        {isResetMode ? "Вернуться ко входу" : "Забыли пароль?"}
                    </button>
                </div>
            </section>
        </main>
    );
}
