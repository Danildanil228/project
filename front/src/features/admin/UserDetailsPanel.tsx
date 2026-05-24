import { UserAvatar } from "../../components/UserAvatar";
import type { BanFormState, EditUserFormState, ManagedAccount, ManagedAuditLog, ManagedSession, ManagedUser } from "../../types/admin";
import { formatDate, shortId } from "../../utils/admin-format";

type UserDetailsPanelProps = {
    selectedUser: ManagedUser | null;
    editForm: EditUserFormState;
    banForm: BanFormState;
    newPassword: string;
    sessions: ManagedSession[];
    accounts: ManagedAccount[];
    auditLogs: ManagedAuditLog[];
    loadingDetails: boolean;
    roleOptions: string[];
    canManageSelectedUser: boolean;
    isSelfSelected: boolean;
    isSuperAdminSelected: boolean;
    onEditFormChange: (form: EditUserFormState) => void;
    onBanFormChange: (form: BanFormState) => void;
    onNewPasswordChange: (value: string) => void;
    onUpdateUser: () => void;
    onDeleteUser: () => void;
    onBanUser: () => void;
    onUnbanUser: () => void;
    onUpdatePassword: () => void;
    onImpersonateUser: () => void;
    onRevokeSession: (token: string) => void;
    onRevokeAllSessions: () => void;
    onUnlinkAccount: (accountId: string) => void;
};

function auditActionText(action: string) {
    const labels: Record<string, string> = {
        "admin.user.role.update": "Изменение роли",
        "admin.account.unlink": "Отвязка аккаунта",
        "admin.users.export": "Экспорт пользователей",
        "better-auth.admin.update-user": "Обновление профиля",
        "better-auth.admin.ban-user": "Блокировка",
        "better-auth.admin.unban-user": "Разблокировка",
        "better-auth.admin.set-user-password": "Смена пароля",
        "better-auth.admin.revoke-user-session": "Отзыв сессии",
        "better-auth.admin.revoke-user-sessions": "Отзыв всех сессий",
        "user.email.verified": "Email подтвержден",
        "user.password.reset": "Сброс пароля",
    };

    return labels[action] ?? action;
}

export function UserDetailsPanel({
    selectedUser,
    editForm,
    banForm,
    newPassword,
    sessions,
    accounts,
    auditLogs,
    loadingDetails,
    roleOptions,
    canManageSelectedUser,
    isSelfSelected,
    isSuperAdminSelected,
    onEditFormChange,
    onBanFormChange,
    onNewPasswordChange,
    onUpdateUser,
    onDeleteUser,
    onBanUser,
    onUnbanUser,
    onUpdatePassword,
    onImpersonateUser,
    onRevokeSession,
    onRevokeAllSessions,
    onUnlinkAccount,
}: UserDetailsPanelProps) {
    return (
        <aside className="panel details-panel">
            <div className="panel-header">
                <div>
                    <h2>Управление</h2>
                    <p className="muted">{selectedUser ? selectedUser.email : "Выберите пользователя слева"}</p>
                </div>
            </div>

            {selectedUser ? (
                <div className="details-stack">
                    <form
                        className="stack"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onUpdateUser();
                        }}
                    >
                        <h3>Профиль</h3>
                        <div className="avatar-preview">
                            <UserAvatar user={{ ...selectedUser, image: editForm.image }} size="lg" />
                            <div>
                                <strong>{selectedUser.name || selectedUser.email}</strong>
                                <span className="muted">Аватар обновится после сохранения профиля.</span>
                            </div>
                        </div>
                        <label>
                            Имя
                            <input value={editForm.name} onChange={(event) => onEditFormChange({ ...editForm, name: event.target.value })} />
                        </label>
                        <label>
                            Email
                            <input type="email" value={editForm.email} onChange={(event) => onEditFormChange({ ...editForm, email: event.target.value })} />
                        </label>
                        <label>
                            Ссылка на аватар
                            <input
                                type="url"
                                placeholder="https://example.com/avatar.png"
                                value={editForm.image}
                                onChange={(event) => onEditFormChange({ ...editForm, image: event.target.value })}
                            />
                        </label>
                        <label>
                            Роль
                            <select
                                value={editForm.role}
                                disabled={!canManageSelectedUser || isSelfSelected}
                                onChange={(event) => onEditFormChange({ ...editForm, role: event.target.value })}
                            >
                                {roleOptions.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button className="primary" type="submit" disabled={!canManageSelectedUser}>
                            Сохранить
                        </button>
                    </form>

                    <div className="actions-row">
                        <button className="secondary" onClick={onImpersonateUser} disabled={!canManageSelectedUser}>
                            Войти как пользователь
                        </button>
                        <button className="danger" onClick={onDeleteUser} disabled={!canManageSelectedUser}>
                            Удалить пользователя
                        </button>
                    </div>

                    {!canManageSelectedUser && !isSuperAdminSelected && (
                        <p className="alert warning">Модератор не может выполнять действия с администратором.</p>
                    )}

                    {isSelfSelected && (
                        <p className="alert warning">Свою роль изменить нельзя. Это защищает аккаунт от случайной потери доступа.</p>
                    )}

                    {isSuperAdminSelected && (
                        <p className="alert warning">Super admin защищен через переменную окружения. Его нельзя редактировать, блокировать, удалять, отзывать сессии или отвязывать аккаунты.</p>
                    )}

                    <section className="subsection">
                        <h3>Блокировка</h3>
                        <label>
                            Причина
                            <input value={banForm.reason} onChange={(event) => onBanFormChange({ ...banForm, reason: event.target.value })} />
                        </label>
                        <label>
                            До даты
                            <input
                                type="datetime-local"
                                value={banForm.expiresAt}
                                onChange={(event) => onBanFormChange({ ...banForm, expiresAt: event.target.value })}
                            />
                        </label>
                        <div className="actions-row">
                            <button className="danger" onClick={onBanUser} disabled={!canManageSelectedUser}>
                                Заблокировать
                            </button>
                            <button className="secondary" onClick={onUnbanUser} disabled={!canManageSelectedUser}>
                                Разблокировать
                            </button>
                        </div>
                    </section>

                    <form
                        className="subsection"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onUpdatePassword();
                        }}
                    >
                        <h3>Пароль</h3>
                        <label>
                            Новый пароль
                            <input type="password" minLength={8} value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} />
                        </label>
                        <button className="secondary" type="submit" disabled={!newPassword || !canManageSelectedUser}>
                            Сменить пароль
                        </button>
                    </form>

                    <section className="subsection">
                        <div className="section-line">
                            <h3>Сессии</h3>
                            <button className="secondary" onClick={onRevokeAllSessions} disabled={!sessions.length || !canManageSelectedUser}>
                                Отозвать все
                            </button>
                        </div>
                        {loadingDetails ? (
                            <p className="muted">Загрузка...</p>
                        ) : (
                            <div className="mini-list">
                                {sessions.map((item) => (
                                    <div className="mini-card" key={item.id}>
                                        <div>
                                            <strong>{shortId(item.id)}</strong>
                                            <span>{item.ipAddress || "IP не указан"}</span>
                                            <span>{formatDate(item.expiresAt)}</span>
                                        </div>
                                        <button className="secondary" onClick={() => onRevokeSession(item.token)} disabled={!canManageSelectedUser}>
                                            Отозвать
                                        </button>
                                    </div>
                                ))}
                                {!sessions.length && <p className="muted">Активных сессий нет</p>}
                            </div>
                        )}
                    </section>

                    <section className="subsection">
                        <h3>Аккаунты</h3>
                        <div className="mini-list">
                            {accounts.map((account) => (
                                <div className="mini-card" key={account.id}>
                                    <div>
                                        <strong>{account.providerId}</strong>
                                        <span>ID аккаунта: {shortId(account.accountId)}</span>
                                        <span>Токены: {account.hasAccessToken || account.hasRefreshToken || account.hasIdToken ? "есть" : "нет"}</span>
                                        <span>Создан: {formatDate(account.createdAt)}</span>
                                    </div>
                                    <button className="secondary" onClick={() => onUnlinkAccount(account.id)} disabled={!canManageSelectedUser}>
                                        Отвязать
                                    </button>
                                </div>
                            ))}
                            {!accounts.length && <p className="muted">Связанных аккаунтов нет</p>}
                        </div>
                    </section>

                    <section className="subsection">
                        <h3>История действий</h3>
                        <div className="mini-list">
                            {auditLogs.map((log) => (
                                <div className="mini-card" key={log.id}>
                                    <div>
                                        <strong>{auditActionText(log.action)}</strong>
                                        <span>Кто: {log.actorEmail || "система"}</span>
                                        <span>{formatDate(log.createdAt)}</span>
                                    </div>
                                </div>
                            ))}
                            {!auditLogs.length && <p className="muted">Истории действий пока нет</p>}
                        </div>
                    </section>
                </div>
            ) : (
                <p className="empty-panel muted">Нет выбранного пользователя.</p>
            )}
        </aside>
    );
}
