import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { UserAvatar } from "../../components/UserAvatar";
import type { BanFormState, EditUserFormState, ManagedAccount, ManagedAuditLog, ManagedSession, ManagedUser } from "../../types/admin";
import { formatDate, shortId } from "../../utils/admin-format";
import { auditActionText, auditDetails, auditSummary } from "../../utils/audit-format";

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
    canUpdateSelectedProfile: boolean;
    canImpersonate: boolean;
    canVerifyEmail: boolean;
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
    onVerifyEmail: (verified: boolean) => void;
    onRevokeSession: (token: string) => void;
    onRevokeAllSessions: () => void;
    onUnlinkAccount: (accountId: string) => void;
};

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
    canUpdateSelectedProfile,
    canImpersonate,
    canVerifyEmail,
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
    onVerifyEmail,
    onRevokeSession,
    onRevokeAllSessions,
    onUnlinkAccount,
}: UserDetailsPanelProps) {
    return (
        <aside className="panel details-panel h-full!">
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
                            <input value={editForm.name} disabled={!canUpdateSelectedProfile} onChange={(event) => onEditFormChange({ ...editForm, name: event.target.value })} />
                        </label>
                        <label>
                            Email
                            <input type="email" value={editForm.email} disabled={!canUpdateSelectedProfile} onChange={(event) => onEditFormChange({ ...editForm, email: event.target.value })} />
                        </label>
                        {/* Avatar is owned by the user — they upload it from their /profile page.
                            Admins see the current value but can't paste arbitrary URLs here. */}
                        <label>
                            Аватар
                            <input
                                type="text"
                                value={editForm.image || "—"}
                                disabled
                                title="Аватар меняется самим пользователем в разделе Профиль"
                            />
                        </label>
                        <label>
                            Роль
                            <select value={editForm.role} disabled={!canManageSelectedUser || isSelfSelected} onChange={(event) => onEditFormChange({ ...editForm, role: event.target.value })}>
                                {roleOptions.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button className="primary" type="submit" disabled={!canUpdateSelectedProfile}>
                            Сохранить
                        </button>
                    </form>

                    {/* Email verification — admin/super-admin only. Lets us approve users whose verification email
                        bounced or who registered before SMTP was configured. */}
                    {canVerifyEmail && (
                        <div className="actions-row" style={{ alignItems: "center" }}>
                            <span className={`self-badge ${selectedUser.emailVerified ? "" : "alert warning"}`} style={{ paddingInline: 8 }}>
                                Email: {selectedUser.emailVerified ? "подтверждён" : "не подтверждён"}
                            </span>
                            {selectedUser.emailVerified ? (
                                <button className="secondary" type="button" onClick={() => onVerifyEmail(false)} disabled={isSuperAdminSelected}>
                                    Снять подтверждение
                                </button>
                            ) : (
                                <button className="primary" type="button" onClick={() => onVerifyEmail(true)} disabled={isSuperAdminSelected}>
                                    Подтвердить email
                                </button>
                            )}
                        </div>
                    )}

                    <div className="actions-row">
                        {canImpersonate && (
                            <button className="secondary" onClick={onImpersonateUser} disabled={!canManageSelectedUser}>
                                Войти как пользователь
                            </button>
                        )}
                        <button className="danger" onClick={onDeleteUser} disabled={!canManageSelectedUser}>
                            Удалить пользователя
                        </button>
                    </div>

                    {!canManageSelectedUser && !isSelfSelected && !isSuperAdminSelected && (
                        <p className="alert warning">Действия доступны только над пользователями с ролью ниже вашей. Равную или более высокую роль менять нельзя.</p>
                    )}

                    {isSelfSelected && <p className="alert warning">Свои имя, email и аватар можно менять. Свою роль и админские действия над собой менять нельзя.</p>}

                    {isSuperAdminSelected && <p className="alert warning">Super admin защищен через переменную окружения. Его нельзя редактировать, блокировать, удалять, отзывать сессии или отвязывать аккаунты.</p>}

                    <section className="subsection">
                        <h3>Блокировка</h3>
                        <label>
                            Причина
                            <input value={banForm.reason} onChange={(event) => onBanFormChange({ ...banForm, reason: event.target.value })} />
                        </label>
                        <label>
                            До даты
                            <input type="datetime-local" value={banForm.expiresAt} onChange={(event) => onBanFormChange({ ...banForm, expiresAt: event.target.value })} />
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

                    {isSelfSelected ? (
                        // Self → use the two-step (old password + email code) flow.
                        // ChangePasswordForm hides itself when the account is OAuth-only.
                        <ChangePasswordForm />
                    ) : (
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
                    )}

                    <section className="subsection">
                        <div className="section-line">
                            <h3>Сессии</h3>
                            {/* Self can revoke own sessions even though they're not "manageable" by role hierarchy. */}
                            <button className="secondary" onClick={onRevokeAllSessions} disabled={!sessions.length || (!canManageSelectedUser && !isSelfSelected)}>
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
                                        <button className="secondary" onClick={() => onRevokeSession(item.token)} disabled={!canManageSelectedUser && !isSelfSelected}>
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
                                        <strong>{auditSummary(log)}</strong>
                                        <span>{auditActionText(log.action)}</span>
                                        {auditDetails(log).slice(0, 2).map((detail) => <span key={`${detail.label}-${detail.value}`}>{detail.label}: {detail.value}</span>)}
                                        <span>{log.outcome === "failure" ? "Ошибка" : "Успешно"} · {formatDate(log.createdAt)}</span>
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
