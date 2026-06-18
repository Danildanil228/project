import type { AuditLogFilters, ManagedAuditLog } from "../../types/admin";
import { formatDate } from "../../utils/admin-format";

type AuditLogPanelProps = {
    logs: ManagedAuditLog[];
    filters: AuditLogFilters;
    total: number;
    offset: number;
    pageSize: number;
    loading: boolean;
    onFiltersChange: (filters: AuditLogFilters) => void;
    onRefresh: () => void;
    onApplyFilters: () => void;
    onResetFilters: () => void;
    onPageChange: (offset: number) => void;
    onExportCsv: () => void;
};

export function auditActionText(action: string) {
    const labels: Record<string, string> = {
        "request.failed": "Отклонённый запрос",
        "auth.register": "Регистрация",
        "auth.login": "Вход в аккаунт",
        "auth.login.social": "Вход через социальную сеть",
        "auth.logout": "Выход из аккаунта",
        "auth.profile.update": "Обновление профиля",
        "auth.password.change": "Смена пароля",
        "auth.password.reset-request": "Запрос сброса пароля",
        "auth.password.reset-complete": "Завершение сброса пароля",
        "auth.email.change": "Смена email",
        "auth.email.verification-request": "Запрос подтверждения email",
        "auth.user.delete": "Удаление своего аккаунта",
        "auth.session.revoke": "Отзыв сессии",
        "auth.sessions.revoke-all": "Отзыв всех сессий",
        "auth.sessions.revoke-others": "Отзыв остальных сессий",
        "auth.account.link": "Привязка аккаунта",
        "auth.account.unlink": "Отвязка аккаунта",
        "admin.audit.export": "Экспорт журнала",
        "admin.user.role.update": "Изменение роли",
        "admin.users.bulk-role": "Массовое изменение ролей",
        "admin.users.bulk-ban": "Массовая блокировка",
        "admin.users.bulk-unban": "Массовая разблокировка",
        "admin.users.export": "Экспорт пользователей",
        "admin.account.unlink": "Отвязка аккаунта",
        "admin.user.impersonate": "Вход от имени пользователя",
        "admin.user.stop-impersonating": "Завершение входа от имени пользователя",
        "better-auth.admin.create-user": "Создание пользователя",
        "better-auth.admin.update-user": "Обновление пользователя",
        "better-auth.admin.ban-user": "Блокировка пользователя",
        "better-auth.admin.unban-user": "Разблокировка пользователя",
        "better-auth.admin.remove-user": "Удаление пользователя",
        "better-auth.admin.set-user-password": "Смена пароля админом",
        "better-auth.admin.revoke-user-session": "Отзыв сессии",
        "better-auth.admin.revoke-user-sessions": "Отзыв всех сессий",
        "better-auth.admin.impersonate-user": "Вход от имени пользователя",
        "better-auth.admin.stop-impersonating": "Завершение входа от имени пользователя",
        "better-auth.change-password": "Смена своего пароля",
        "better-auth.update-user": "Обновление профиля",
        "email.verification.sent": "Отправка подтверждения email",
        "email.password-reset.sent": "Отправка сброса пароля",
        "user.email.verified": "Email подтвержден",
        "user.password.reset": "Пароль сброшен",
        "post.create-draft": "Создание черновика",
        "post.update-draft": "Обновление черновика",
        "post.submit": "Отправка поста на модерацию",
        "post.publish-direct": "Прямая публикация поста",
        "post.delete-own": "Удаление своего поста",
        "post.claim": "Пост взят на модерацию",
        "post.release": "Пост освобождён модератором",
        "post.approve": "Одобрение поста",
        "post.reject": "Отклонение поста",
        "post.remove": "Удаление поста модератором",
        "post.pin": "Закрепление поста",
        "post.unpin": "Открепление поста",
        "post.moderate-edit": "Редактирование поста модератором",
        "comment.create": "Добавление комментария",
        "comment.delete-own": "Удаление своего комментария",
        "comment.delete-moderate": "Удаление комментария модератором",
        "reaction.set": "Добавление реакции",
        "reaction.change": "Изменение реакции",
        "reaction.remove": "Удаление реакции",
        "report.create": "Создание жалобы",
        "report.resolved": "Подтверждение жалобы",
        "report.rejected": "Отклонение жалобы",
        "notification.read": "Прочтение уведомлений",
        "notification.read-all": "Прочтение всех уведомлений",
        "upload.avatar": "Загрузка аватара",
        "upload.post-image": "Загрузка изображения поста",
        "upload.item-image": "Загрузка изображения предмета",
        "upload.item-model": "Загрузка 3D-модели предмета",
        "admin.fish.create": "Добавление рыбы",
        "admin.fish.update": "Изменение рыбы",
        "admin.fish.delete": "Удаление рыбы",
        "admin.waterbody.create": "Добавление водоёма",
        "admin.waterbody.update": "Изменение водоёма",
        "admin.waterbody.delete": "Удаление водоёма",
        "admin.reels.create": "Добавление катушки",
        "admin.reels.update": "Изменение катушки",
        "admin.reels.delete": "Удаление катушки",
        "admin.rods.create": "Добавление удилища",
        "admin.rods.update": "Изменение удилища",
        "admin.rods.delete": "Удаление удилища",
    };

    if (labels[action]) return labels[action];
    if (action.endsWith(".failed")) {
        const baseAction = action.slice(0, -7);
        return `${labels[baseAction] ?? baseAction} — ошибка`;
    }
    return action;
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
    offset,
    pageSize,
    loading,
    onFiltersChange,
    onRefresh,
    onApplyFilters,
    onResetFilters,
    onPageChange,
    onExportCsv,
}: AuditLogPanelProps) {
    const from = total ? offset + 1 : 0;
    const to = Math.min(offset + pageSize, total);
    const hasPreviousPage = offset > 0;
    const hasNextPage = offset + pageSize < total;

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
                    onApplyFilters();
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
                <select
                    aria-label="Результат действия"
                    value={filters.outcome}
                    onChange={(event) => onFiltersChange({ ...filters, outcome: event.target.value as AuditLogFilters["outcome"] })}
                >
                    <option value="">Любой результат</option>
                    <option value="success">Успешно</option>
                    <option value="failure">Ошибка</option>
                </select>
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
                <button className="link-button" type="button" onClick={onResetFilters}>
                    Сбросить
                </button>
            </form>

            <div className="audit-count">
                <p className="muted">Найдено записей: {total}</p>
                <div className="actions-row">
                    <button className="secondary" type="button" disabled={!hasPreviousPage || loading} onClick={() => onPageChange(Math.max(0, offset - pageSize))}>
                        Назад
                    </button>
                    <span className="muted">
                        {from}-{to}
                    </span>
                    <button className="secondary" type="button" disabled={!hasNextPage || loading} onClick={() => onPageChange(offset + pageSize)}>
                        Далее
                    </button>
                </div>
            </div>

            <div className="audit-list">
                {logs.map((log) => (
                    <article className="audit-item" key={log.id}>
                        <div>
                            <strong>{auditActionText(log.action)}</strong>
                            <span>{log.outcome === "failure" ? "Ошибка" : "Успешно"} · {formatDate(log.createdAt)}</span>
                        </div>
                        <div>
                            <span>Кто: {log.actorEmail || "система"}{log.actorRole ? ` (${log.actorRole})` : ""}</span>
                            <span>Цель: {log.targetEmail || log.targetUserId || "-"}</span>
                        </div>
                        {(log.method || log.path || log.ipAddress) && (
                            <div>
                                <span title={log.userAgent || undefined}>{[log.method, log.path].filter(Boolean).join(" ")}</span>
                                <span>IP: {log.ipAddress || "-"}</span>
                            </div>
                        )}
                        {log.requestId && <small>Request ID: {log.requestId}</small>}
                        {Boolean(metadataPreview(log.metadata)) && <small>{metadataPreview(log.metadata)}</small>}
                    </article>
                ))}

                {!logs.length && <p className="empty-panel muted">{loading ? "Загрузка..." : "Записей пока нет"}</p>}
            </div>
        </section>
    );
}
