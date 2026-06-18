import { useEffect, useState, type FormEvent } from "react";
import { UserAvatar } from "../components/UserAvatar";
import { authApi } from "../lib/auth-api";
import type { AdminSecurityContext, ManagedSession, ManagedUser } from "../types/admin";
import { displayRoleText, formatDate, getErrorMessage, shortId } from "../utils/admin-format";
import { unwrapAuthResult } from "../utils/auth-client-result";
import { MyPostsPage } from "./MyPostsPage";

type ProfilePageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onSessionRefresh: () => Promise<void>;
    onOpenAuthModal: () => void;
};

export function ProfilePage({ currentUser, adminContext, onSessionRefresh, onOpenAuthModal }: ProfilePageProps) {
    const [name, setName] = useState(currentUser?.name ?? "");
    const [image, setImage] = useState(currentUser?.image ?? "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [sessions, setSessions] = useState<ManagedSession[]>([]);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [loadingSessions, setLoadingSessions] = useState(false);

    async function loadSessions() {
        setLoadingSessions(true);
        setError("");
        try {
            const response = await unwrapAuthResult<ManagedSession[]>(authApi.listSessions());
            setSessions(response ?? []);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoadingSessions(false);
        }
    }

    async function updateProfile(event: FormEvent) {
        event.preventDefault();
        setNotice("");
        setError("");
        try {
            await unwrapAuthResult(authApi.updateUser({ name, image: image || null }));
            await onSessionRefresh();
            setNotice("Профиль обновлен");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    async function changePassword(event: FormEvent) {
        event.preventDefault();
        setNotice("");
        setError("");
        try {
            await unwrapAuthResult(
                authApi.changePassword({
                    currentPassword,
                    newPassword,
                    revokeOtherSessions: true,
                }),
            );
            setCurrentPassword("");
            setNewPassword("");
            await loadSessions();
            setNotice("Пароль изменен, другие сессии отозваны");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    async function sendVerificationEmail() {
        if (!currentUser?.email) return;
        setNotice("");
        setError("");
        try {
            await unwrapAuthResult(
                authApi.sendVerificationEmail({
                    email: currentUser.email,
                    callbackURL: `${window.location.origin}/profile`,
                }),
            );
            setNotice("Ссылка подтверждения отправлена. В dev-режиме она появится в консоли бэкенда.");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    async function revokeSession(token: string) {
        setNotice("");
        setError("");
        try {
            await unwrapAuthResult(authApi.revokeSession({ token }));
            await loadSessions();
            setNotice("Сессия отозвана");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    async function revokeAllSessions() {
        const confirmed = window.confirm("Выйти со всех устройств? Текущая сессия тоже будет завершена.");
        if (!confirmed) return;
        setNotice("");
        setError("");
        try {
            await unwrapAuthResult(authApi.revokeSessions());
            await onSessionRefresh();
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    useEffect(() => {
        queueMicrotask(() => {
            void loadSessions();
        });
    }, [currentUser?.id]);

    if (!currentUser) {
        return (
            <section className="profile-page">
                <div className="panel home-card" style={{ textAlign: "center" }}>
                    <h2>Доступ ограничен</h2>
                    <p className="muted">Для просмотра профиля необходимо войти в аккаунт.</p>
                    <button className="primary" onClick={onOpenAuthModal}>
                        Войти / Зарегистрироваться
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="profile-page">
            <div className="page-heading">
                <p className="eyebrow">Профиль</p>
                <h2>Настройки аккаунта</h2>
                <p className="muted">Личные данные, пароль, подтверждение email и активные сессии.</p>
            </div>

            {notice && <p className="alert success">{notice}</p>}
            {error && <p className="alert error">{error}</p>}

            <div className="profile-layout">
                <section className="panel profile-card">
                    <form className="stack" onSubmit={updateProfile}>
                        <div className="profile-heading">
                            <UserAvatar
                                user={{
                                    name: name || currentUser?.name || "",
                                    email: currentUser?.email || "",
                                    image,
                                }}
                                size="lg"
                            />
                            <div>
                                <h3>{currentUser?.email}</h3>
                                <p className="muted">Роль: {displayRoleText(currentUser, adminContext)}</p>
                            </div>
                        </div>

                        <label>
                            Имя
                            <input value={name} onChange={(event) => setName(event.target.value)} required />
                        </label>
                        <label>
                            Ссылка на аватар
                            <input type="url" placeholder="https://example.com/avatar.png" value={image} onChange={(event) => setImage(event.target.value)} />
                        </label>

                        <div className="section-line">
                            <span>Email подтвержден: {currentUser?.emailVerified ? "да" : "нет"}</span>
                            {!currentUser?.emailVerified && (
                                <button className="secondary" type="button" onClick={sendVerificationEmail}>
                                    Отправить подтверждение
                                </button>
                            )}
                        </div>

                        <button className="primary" type="submit">
                            Сохранить профиль
                        </button>
                    </form>
                </section>

                <form className="panel profile-card stack" onSubmit={changePassword}>
                    <h3>Пароль</h3>
                    <label>
                        Текущий пароль
                        <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
                    </label>
                    <label>
                        Новый пароль
                        <input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
                    </label>
                    <button className="secondary" type="submit">
                        Изменить пароль
                    </button>
                </form>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Мои сессии</h2>
                        <p className="muted">Устройства и браузеры, где открыт аккаунт.</p>
                    </div>
                    <div className="actions-row">
                        <button className="secondary" onClick={loadSessions} disabled={loadingSessions}>
                            Обновить
                        </button>
                        <button className="danger" onClick={revokeAllSessions} disabled={!sessions.length}>
                            Выйти везде
                        </button>
                    </div>
                </div>

                <div className="mini-list sessions-list">
                    {sessions.map((session) => (
                        <div className="mini-card" key={session.id}>
                            <div>
                                <strong>{shortId(session.id)}</strong>
                                <span>{session.ipAddress || "IP не указан"}</span>
                                <span>{session.userAgent || "User-Agent не указан"}</span>
                                <span>Истекает: {formatDate(session.expiresAt)}</span>
                            </div>
                            <button className="secondary" onClick={() => revokeSession(session.token)}>
                                Отозвать
                            </button>
                        </div>
                    ))}
                    {!sessions.length && <p className="empty-panel muted">{loadingSessions ? "Загрузка..." : "Активных сессий нет"}</p>}
                </div>
            </section>

            {/* "Мои посты" moved here from a dedicated nav entry — keeps profile-related actions together. */}
            <section className="mt-6">
                <MyPostsPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={onOpenAuthModal} />
            </section>
        </section>
    );
}
