import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../lib/auth-api";
import { getErrorMessage } from "../utils/admin-format";
import { unwrapAuthResult } from "../utils/auth-client-result";

export function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
    const [password, setPassword] = useState("");
    const [notice, setNotice] = useState("");
    const [error, setError] = useState(searchParams.get("error") ? "Ссылка сброса пароля недействительна или устарела" : "");

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setNotice("");
        setError("");

        try {
            await unwrapAuthResult(authApi.resetPassword({ newPassword: password, token }));
            setNotice("Пароль изменен. Теперь можно войти с новым паролем.");
            setTimeout(() => navigate("/", { replace: true }), 900);
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-panel">
                <div>
                    <p className="eyebrow">Восстановление</p>
                    <h1>Новый пароль</h1>
                    <p className="muted">Введите новый пароль для аккаунта.</p>
                </div>

                {!token ? (
                    <p className="alert error">Токен сброса не найден. Запросите новую ссылку восстановления.</p>
                ) : (
                    <form className="stack" onSubmit={handleSubmit}>
                        <label>
                            Новый пароль
                            <input
                                type="password"
                                minLength={8}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                        </label>

                        {notice && <p className="alert success">{notice}</p>}
                        {error && <p className="alert error">{error}</p>}

                        <button className="primary" type="submit">
                            Сохранить пароль
                        </button>
                    </form>
                )}

                <Link className="link-button" to="/">
                    Вернуться ко входу
                </Link>
            </section>
        </main>
    );
}
