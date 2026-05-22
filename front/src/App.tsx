import { useState } from "react";
import { authClient } from "./lib/auth-client";

function App() {
    const { data: session, isPending, refetch } = authClient.useSession();
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
                refetch();
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
                refetch();
            }
        }
    };

    const handleLogout = async () => {
        await authClient.signOut();
        refetch();
    };

    if (isPending) {
        return <div>Загрузка...</div>;
    }

    if (session) {
        return (
            <div>
                <h1>Добро пожаловать, {session.user.name || session.user.email}!</h1>
                <p>Email: {session.user.email}</p>
                <button onClick={handleLogout}>Выйти</button>
            </div>
        );
    }

    return (
        <div>
            <h1>{isLogin ? "Вход" : "Регистрация"}</h1>
            <form onSubmit={handleSubmit}>
                {!isLogin && (
                    <div>
                        <label>Имя:</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" />
                    </div>
                )}
                <div>
                    <label>Email:</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
                </div>
                <div>
                    <label>Пароль:</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" required />
                </div>
                {error && <p style={{ color: "red" }}>{error}</p>}
                <button type="submit">{isLogin ? "Войти" : "Зарегистрироваться"}</button>
            </form>
            <button onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Нет аккаунта? Зарегистрироваться" : "Есть аккаунт? Войти"}</button>
        </div>
    );
}

export default App;
