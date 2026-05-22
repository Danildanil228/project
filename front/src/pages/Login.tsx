import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (isLogin) {
            const { error } = await authClient.signIn.email({
                email,
                password,
            });

            if (error) {
                setError(error.message || "Ошибка входа");
            } else {
                navigate("/");
            }
        } else {
            const { error } = await authClient.signUp.email({
                email,
                password,
                name,
            });

            if (error) {
                setError(error.message || "Ошибка регистрации");
            } else {
                navigate("/");
            }
        }
    };

    return (
        <div className="grid justify-center text-center">
            <h1>{isLogin ? "Вход" : "Регистрация"}</h1>
            <form onSubmit={handleSubmit}>
                {!isLogin && (
                    <div>
                        <label>Имя:</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!isLogin} />
                    </div>
                )}
                <div>
                    <label>Email:</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label>Пароль:</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {error && <p style={{ color: "red" }}>{error}</p>}
                <button type="submit">{isLogin ? "Войти" : "Зарегистрироваться"}</button>
            </form>
            <button onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Нет аккаунта? Зарегистрироваться" : "Есть аккаунт? Войти"}</button>
        </div>
    );
}
