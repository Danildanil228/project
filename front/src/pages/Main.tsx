import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

interface User {
    id: string;
    name: string;
    email: string;
    role?: string;
    banned: boolean | null;
    createdAt: Date;
}

export function Main() {
    const navigate = useNavigate();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        const getSession = async () => {
            const { data } = await authClient.getSession();
            if (!data) {
                navigate("/login");
            } else {
                setSession(data);
            }
            setLoading(false);
        };
        getSession();
    }, [navigate]);

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const { data, error: fetchError } = await authClient.admin.listUsers({
                query: {
                    limit: 100,
                    offset: 0,
                },
            });

            if (fetchError) {
                setError(fetchError.message || "Ошибка загрузки");
            } else {
                setUsers(data?.users || []);
            }
        } catch (err) {
            setError("Ошибка при запросе");
        } finally {
            setUsersLoading(false);
        }
    };

    const handleBan = async (userId: string) => {
        setActionLoading(userId);
        try {
            const { error } = await authClient.admin.banUser({
                userId: userId,
                banReason: "Нарушение правил",
            });

            if (error) {
                alert("Ошибка бана: " + error.message);
            } else {
                alert("Пользователь забанен");
                await fetchUsers();
            }
        } catch (err) {
            alert("Ошибка при бане");
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnban = async (userId: string) => {
        setActionLoading(userId);
        try {
            const { error } = await authClient.admin.unbanUser({
                userId: userId,
            });

            if (error) {
                alert("Ошибка разбана: " + error.message);
            } else {
                alert("Пользователь разбанен");
                await fetchUsers();
            }
        } catch (err) {
            alert("Ошибка при разбане");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevokeSessions = async (userId: string) => {
        setActionLoading(userId);
        try {
            const { error } = await authClient.admin.revokeUserSessions({
                userId: userId,
            });

            if (error) {
                alert("Ошибка удаления сессий: " + error.message);
            } else {
                alert("Все сессии пользователя удалены");
            }
        } catch (err) {
            alert("Ошибка при удалении сессий");
        } finally {
            setActionLoading(null);
        }
    };

    const handleLogout = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    navigate("/login");
                },
            },
        });
    };

    useEffect(() => {
        if (session) {
            fetchUsers();
        }
    }, [session]);

    if (loading) return <div>Загрузка...</div>;
    if (!session) return null;

    const isAdmin = session.user?.role === "admin";

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Добро пожаловать, {session.user.name}!</h1>
                <button onClick={handleLogout}>Выйти</button>
            </div>
            <p>Email: {session.user.email}</p>
            <p>
                Роль: <strong>{session.user.role || "user"}</strong>
            </p>

            {isAdmin && (
                <>
                    <h2>Управление пользователями</h2>
                    {usersLoading && <div>Загрузка...</div>}
                    {error && <div>Ошибка: {error}</div>}
                    {!usersLoading && !error && (
                        <table border={1} cellPadding="8" cellSpacing="0">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Имя</th>
                                    <th>Email</th>
                                    <th>Роль</th>
                                    <th>Забанен</th>
                                    <th>Дата регистрации</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.id}</td>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td>{user.role || "user"}</td>
                                        <td>{user.banned ? "Да" : "Нет"}</td>
                                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            {user.banned ? (
                                                <button onClick={() => handleUnban(user.id)} disabled={actionLoading === user.id}>
                                                    {actionLoading === user.id ? "..." : "Разбанить"}
                                                </button>
                                            ) : (
                                                <button onClick={() => handleBan(user.id)} disabled={actionLoading === user.id}>
                                                    {actionLoading === user.id ? "..." : "Забанить"}
                                                </button>
                                            )}
                                            <button onClick={() => handleRevokeSessions(user.id)} disabled={actionLoading === user.id} style={{ marginLeft: "8px" }}>
                                                {actionLoading === user.id ? "..." : "Удалить сессии"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
}
