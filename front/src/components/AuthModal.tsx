import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { useAuthModal } from "../context/AuthModalContext";

type AuthModalProps = {
    onSuccess: () => void;
};

export function AuthModal({ onSuccess }: AuthModalProps) {
    const { open, setOpen } = useAuthModal();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setNotice("");
        try {
            if (isLogin) {
                const result = await authClient.signIn.email({ email, password });
                if (result.error) throw new Error(result.error.message);
                onSuccess(); // обновить сессию в родителе
                setOpen(false);
            } else {
                const result = await authClient.signUp.email({ email, password, name });
                if (result.error) throw new Error(result.error.message);
                setNotice("Аккаунт создан. Подтвердите email по ссылке (в dev-режиме она появится в консоли бэкенда), затем войдите.");
                setIsLogin(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка");
        }
    };

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
                    {notice && <p className="alert success">{notice}</p>}
                    {error && <p className="alert error">{error}</p>}
                    <button className="primary" type="submit">
                        {isLogin ? "Войти" : "Создать аккаунт"}
                    </button>
                </form>
                <button className="link-button" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
                </button>
            </div>
        </div>
    );
}
