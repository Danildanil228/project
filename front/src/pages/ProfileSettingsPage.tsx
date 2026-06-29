import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import { AvatarUploadField } from "../components/AvatarUploadField";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { SessionCard } from "../components/SessionCard";
import { TelegramLinkPanel } from "../components/TelegramLinkPanel";
import { NotificationSoundSettings } from "../components/NotificationSoundSettings";
import { UserAvatar } from "../components/UserAvatar";
import { ListSkeleton } from "../components/LoadingState";
import { authApi } from "../lib/auth-api";
import type { AdminSecurityContext, ManagedSession, ManagedUser } from "../types/admin";
import { displayRoleText, getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";
import { unwrapAuthResult } from "../utils/auth-client-result";

type Props = {
    currentUser?: ManagedUser;
    currentSessionToken?: string;
    adminContext?: AdminSecurityContext | null;
    onSessionRefresh: () => Promise<void>;
    onOpenAuthModal: () => void;
};

// Settings live separately from the public profile so the profile page is purely informational —
// avatar/email/name editing, password change, and active sessions only show up here.
export function ProfileSettingsPage({ currentUser, currentSessionToken, adminContext, onSessionRefresh, onOpenAuthModal }: Props) {
    const [name, setName] = useState(currentUser?.name ?? "");
    const [image, setImage] = useState(currentUser?.image ?? "");
    const [sessions, setSessions] = useState<ManagedSession[]>([]);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [loadingSessions, setLoadingSessions] = useState(false);
    const { confirm, dialog: confirmDialog } = useConfirmDialog();

    const orderedSessions = useMemo(
        () => [...sessions].sort((left, right) => {
            if (left.token === currentSessionToken) return -1;
            if (right.token === currentSessionToken) return 1;
            return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
        }),
        [currentSessionToken, sessions],
    );
    const otherSessionCount = currentSessionToken
        ? sessions.filter((session) => session.token !== currentSessionToken).length
        : Math.max(0, sessions.length - 1);

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
            setNotice("Другая сессия завершена.");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    async function revokeOtherSessions() {
        const confirmed = await confirm({
            title: "Завершить другие сессии?",
            message: `Будут завершены другие активные сессии: ${otherSessionCount}. На этом устройстве вы останетесь в аккаунте.`,
            confirmText: "Завершить другие",
            tone: "danger",
        });
        if (!confirmed) return;
        setNotice("");
        setError("");
        try {
            await unwrapAuthResult(authApi.revokeOtherSessions());
            await loadSessions();
            setNotice("Другие сессии завершены. Текущая сессия сохранена.");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    useEffect(() => {
        queueMicrotask(() => { void loadSessions(); });
    }, [currentUser?.id]);

    if (!currentUser) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Настройки" title="Доступ ограничен" description="Войдите в аккаунт, чтобы открыть настройки." />
                <button className="primary justify-self-start" onClick={onOpenAuthModal}>
                    Войти / Зарегистрироваться
                </button>
            </section>
        );
    }

    return (
        <section className="grid gap-5">
            <PageHeader
                eyebrow="Аккаунт"
                title="Настройки профиля"
                description="Профиль, безопасность, уведомления и активные сессии."
                actions={
                    <Link to="/profile" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:border-primary">
                        <ArrowLeft size={14} /> К профилю
                    </Link>
                }
            />

            {notice && <p className="alert success">{notice}</p>}
            {error && <p className="alert error">{error}</p>}
            {confirmDialog}

            <div className="profile-layout">
                <section className="panel profile-card">
                    <form className="stack" onSubmit={updateProfile}>
                        <div className="profile-heading">
                            <UserAvatar
                                user={{ name: name || currentUser?.name || "", email: currentUser?.email || "", image }}
                                size="lg"
                            />
                            <div>
                                <h3>{currentUser?.email}</h3>
                                {hasElevatedUserAccess(currentUser, adminContext) && (
                                    <p className="muted">Роль: {displayRoleText(currentUser, adminContext)}</p>
                                )}
                            </div>
                        </div>

                        <label>
                            Имя
                            <input value={name} onChange={(event) => setName(event.target.value)} required />
                        </label>
                        {/* File-only avatar — backend deletes the previous file on replace. */}
                        <AvatarUploadField value={image} onChange={setImage} />

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

                {/* OAuth-only users have no password to change — ChangePasswordForm renders nothing for them.
                    TelegramLinkPanel also self-hides for non-moderator users (the API returns 403). */}
                <div className="panel profile-card stack profile-security-card">
                    <ChangePasswordForm />
                    <TelegramLinkPanel />
                </div>
            </div>

            <NotificationSoundSettings />

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Мои сессии</h2>
                        <p className="muted">Устройства и браузеры, где открыт аккаунт.</p>
                    </div>
                    <div className="actions-row">
                        <button className="secondary inline-flex items-center justify-center gap-2" type="button" onClick={loadSessions} disabled={loadingSessions}>
                            <RefreshCw size={14} /> Обновить
                        </button>
                        <button className="danger inline-flex items-center justify-center gap-2" type="button" onClick={revokeOtherSessions} disabled={loadingSessions || otherSessionCount === 0}>
                            <LogOut size={14} /> Завершить другие
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 p-4">
                    {orderedSessions.map((session) => (
                        <SessionCard
                            key={session.id}
                            session={session}
                            isCurrent={session.token === currentSessionToken}
                            disabled={loadingSessions}
                            onRevoke={revokeSession}
                        />
                    ))}
                    {!sessions.length && (loadingSessions ? <ListSkeleton count={3} /> : <p className="empty-panel muted">Активных сессий нет</p>)}
                </div>
            </section>
        </section>
    );
}
