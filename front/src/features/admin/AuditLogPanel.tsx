import { CheckCircle2, ChevronDown, Download, RefreshCw, XCircle } from "lucide-react";
import type { AuditLogFilters, ManagedAuditLog } from "../../types/admin";
import { formatDate } from "../../utils/admin-format";
import { auditActionText, auditClientText, auditDetails, auditRoleText, auditSummary } from "../../utils/audit-format";

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

function AuditLogItem({ log }: { log: ManagedAuditLog }) {
    const details = auditDetails(log);
    const role = auditRoleText(log.actorRole);
    const client = auditClientText(log.userAgent);
    const hasTechnicalDetails = Boolean(log.method || log.path || log.ipAddress || log.requestId || client);

    return (
        <article className={`audit-item audit-item--${log.outcome}`}>
            <div className="audit-item__header">
                <div className="audit-item__summary">
                    <strong>{auditSummary(log)}</strong>
                    <span>{auditActionText(log.action)}{role ? ` · ${role}` : ""}</span>
                </div>
                <div className={`audit-status audit-status--${log.outcome}`}>
                    {log.outcome === "failure" ? <XCircle aria-hidden="true" size={15} /> : <CheckCircle2 aria-hidden="true" size={15} />}
                    <span>{log.outcome === "failure" ? "Ошибка" : "Успешно"}</span>
                    <time dateTime={String(log.createdAt)}>{formatDate(log.createdAt)}</time>
                </div>
            </div>

            {details.length > 0 && (
                <dl className="audit-details">
                    {details.map((detail) => (
                        <div key={`${detail.label}-${detail.value}`}>
                            <dt>{detail.label}</dt>
                            <dd>{detail.value}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {hasTechnicalDetails && (
                <details className="audit-technical">
                    <summary>
                        <ChevronDown aria-hidden="true" size={15} />
                        Технические данные
                    </summary>
                    <dl>
                        {(log.method || log.path) && <div><dt>Запрос</dt><dd>{[log.method, log.path].filter(Boolean).join(" ")}</dd></div>}
                        {log.ipAddress && <div><dt>IP-адрес</dt><dd>{log.ipAddress}</dd></div>}
                        {client && <div><dt>Клиент</dt><dd title={log.userAgent || undefined}>{client}</dd></div>}
                        {log.requestId && <div><dt>Request ID</dt><dd>{log.requestId}</dd></div>}
                        <div><dt>Код события</dt><dd>{log.action}</dd></div>
                    </dl>
                </details>
            )}
        </article>
    );
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
                    <p className="muted">История изменений, действий пользователей и событий безопасности.</p>
                </div>
                <div className="actions-row">
                    <button className="secondary" onClick={onExportCsv} disabled={loading || !logs.length} title="Экспортировать в CSV">
                        <Download aria-hidden="true" size={16} />
                        CSV
                    </button>
                    <button className="secondary" onClick={onRefresh} disabled={loading} title="Обновить журнал">
                        <RefreshCw aria-hidden="true" size={16} />
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
                    placeholder="Инициатор: email"
                    value={filters.actorEmail}
                    onChange={(event) => onFiltersChange({ ...filters, actorEmail: event.target.value })}
                />
                <input
                    placeholder="Цель: email"
                    value={filters.targetEmail}
                    onChange={(event) => onFiltersChange({ ...filters, targetEmail: event.target.value })}
                />
                <select
                    aria-label="Раздел действий"
                    value={filters.action}
                    onChange={(event) => onFiltersChange({ ...filters, action: event.target.value })}
                >
                    <option value="">Все действия</option>
                    <option value="auth">Авторизация и безопасность</option>
                    <option value="post.">Публикации и модерация</option>
                    <option value="comment.">Комментарии</option>
                    <option value="reaction.">Реакции</option>
                    <option value="report.">Жалобы</option>
                    <option value="notification.">Уведомления</option>
                    <option value="upload.">Загрузки файлов</option>
                    <option value="admin">Администрирование</option>
                    <option value="request.failed">Отклонённые запросы</option>
                </select>
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
                <button className="secondary" type="submit">Применить</button>
                <button className="link-button" type="button" onClick={onResetFilters}>Сбросить</button>
            </form>

            <div className="audit-count">
                <p className="muted">Найдено записей: {total}</p>
                <div className="actions-row">
                    <button className="secondary" type="button" disabled={!hasPreviousPage || loading} onClick={() => onPageChange(Math.max(0, offset - pageSize))}>Назад</button>
                    <span className="muted">{from}-{to}</span>
                    <button className="secondary" type="button" disabled={!hasNextPage || loading} onClick={() => onPageChange(offset + pageSize)}>Далее</button>
                </div>
            </div>

            <div className="audit-list">
                {logs.map((log) => <AuditLogItem key={log.id} log={log} />)}
                {!logs.length && <p className="empty-panel muted">{loading ? "Загрузка..." : "Записей пока нет"}</p>}
            </div>
        </section>
    );
}
