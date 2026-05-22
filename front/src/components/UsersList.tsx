import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

interface User {
    id: string;
    name: string;
    email: string;
    role?: string;
    banned: boolean | null;
    createdAt: Date;
}

export function UsersList() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
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
            setLoading(false);
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

    useEffect(() => {
        fetchUsers();
    }, []);

    if (loading) return <div>Загрузка...</div>;
    if (error) return <div>Ошибка: {error}</div>;

    return (
        <div>
            <h2>Пользователи ({users.length})</h2>
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
                            <td>{user.createdAt.toLocaleDateString()}</td>
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
        </div>
    );
}
