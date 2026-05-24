import type { AuditLogFilters, ManagedAuditLog } from "../../types/admin";
import { formatDate } from "../../utils/admin-format";

type AuditLogPanelProps = {
    logs: ManagedAuditLog[];
    filters: AuditLogFilters;
    total: number;
    loading: boolean;
    onFiltersChange: (filters: AuditLogFilters) => void;
    onRefresh: () => void;
    onExportCsv: () => void;
};

function actionText(action: string) {
    const labels: Record<string, string> = {
        "admin.audit.export": "Экспорт журнала",
        "admin.user.role.update": "Изменение роли",
        "admin.users.bulk-role": "Массовое изменение ролей",
        "admin.users.bulk-ban": "Массовая блокировка",
        "admin.users.bulk-unban": "Массовая разблокировка",
        "admin.users.export": "Экспорт пользователей",
        "admin.account.unlink": "Отвязка аккаунта",
        "better-auth.admin.create-user": "Создание пользователя",
        "better-auth.admin.update-user": "Обновление пользователя",
        "better-auth.admin.ban-user": "Блокировка пользователя",
        "better-auth.admin.unban-user": "Разблокировка пользователя",
        "better-auth.admin.remove-user": "Удаление пользователя",
        "better-auth.admin.set-user-password": "Смена пароля админом",
        "better-auth.admin.revoke-user-session": "Отзыв сессии",
        "better-auth.admin.revoke-user-sessions": "Отзыв всех сессий",
        "better-auth.change-password": "Смена своего пароля",
        "better-auth.update-user": "Обновление профиля",
        "email.verification.sent": "Отправка подтверждения email",
        "email.password-reset.sent": "Отправка сброса пароля",
        "user.email.verified": "Email подтвержден",
        "user.password.reset": "Пароль сброшен",
    };

    return labels[action] ?? action;
}

function metadataPreview(metadata: Record<string, unknown>) {
    const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined && value !== "");
    if (!entries.length) return "";

    return entries
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
        .join("; ");
}

export function AuditLogPanel({
    logs,
    filters,
    total,
    loading,
    onFiltersChange,
    onRefresh,
    onExportCsv,
}: AuditLogPanelProps) {
    return (
        <section className="panel audit-panel">
            <div className="panel-header">
                <div>
                    <h2>Журнал действий</h2>
                    <p className="muted">Фильтры, метаданные и экспорт важных действий админов и системных auth-событий.</p>
                </div>
                <div className="actions-row">
                    <button className="secondary" onClick={onExportCsv} disabled={loading || !logs.length}>
                        CSV
                    </button>
                    <button className="secondary" onClick={onRefresh} disabled={loading}>
                        Обновить
                    </button>
                </div>
            </div>

            <form
                className="toolbar audit-toolbar"
                onSubmit={(event) => {
                    event.preventDefault();
                    onRefresh();
                }}
            >
                <input
                    placeholder="Email администратора"
                    value={filters.actorEmail}
                    onChange={(event) => onFiltersChange({ ...filters, actorEmail: event.target.value })}
                />
                <input
                    placeholder="Email цели"
                    value={filters.targetEmail}
                    onChange={(event) => onFiltersChange({ ...filters, targetEmail: event.target.value })}
                />
                <input
                    placeholder="Действие"
                    value={filters.action}
                    onChange={(event) => onFiltersChange({ ...filters, action: event.target.value })}
                />
                <input
                    aria-label="Дата с"
                    type="datetime-local"
                    value={filters.from}
                    onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })}
                />
                <input
                    aria-label="Дата до"
                    type="datetime-local"
                    value={filters.to}
                    onChange={(event) => onFiltersChange({ ...filters, to: event.target.value })}
                />
                <button className="secondary" type="submit">
                    Применить
                </button>
            </form>

            <p className="muted audit-count">Найдено записей: {total}</p>

            <div className="audit-list">
                {logs.map((log) => (
                    <article className="audit-item" key={log.id}>
                        <div>
                            <strong>{actionText(log.action)}</strong>
                            <span>{formatDate(log.createdAt)}</span>
                        </div>
                        <div>
                            <span>Кто: {log.actorEmail || "система"}</span>
                            <span>Цель: {log.targetEmail || log.targetUserId || "-"}</span>
                        </div>
                        {Boolean(metadataPreview(log.metadata)) && <small>{metadataPreview(log.metadata)}</small>}
                    </article>
                ))}

                {!logs.length && <p className="empty-panel muted">{loading ? "Загрузка..." : "Записей пока нет"}</p>}
            </div>
        </section>
    );
}
