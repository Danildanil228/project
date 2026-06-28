import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListSkeleton } from "../components/LoadingState";
import { listReports, resolveReport } from "../lib/engagement-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { ReportRow, ReportStatus } from "../types/post";
import { formatDate, getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type ReportsPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

const pageSize = 20;

const statusFilters: { value: ReportStatus; label: string }[] = [
    { value: "open", label: "Открытые" },
    { value: "resolved", label: "Решённые" },
    { value: "rejected", label: "Отклонённые" },
];

const statusLabels: Record<ReportStatus, string> = {
    open: "Открыта",
    resolved: "Решена",
    rejected: "Отклонена",
};

export function ReportsPage({ currentUser, adminContext, onOpenAuthModal }: ReportsPageProps) {
    const canModerate = hasElevatedUserAccess(currentUser, adminContext);
    const [status, setStatus] = useState<ReportStatus>("open");
    const [items, setItems] = useState<ReportRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busyId, setBusyId] = useState<number | null>(null);

    async function load() {
        setLoading(true);
        setError("");
        try {
            const response = await listReports({ status, limit: pageSize, offset });
            setItems(response.items);
            setTotal(response.total);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (canModerate) void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canModerate, status, offset]);

    async function resolve(report: ReportRow, next: "resolved" | "rejected") {
        setBusyId(report.id);
        setNotice("");
        setError("");
        try {
            await resolveReport(report.id, next);
            setNotice(next === "resolved" ? "Жалоба отмечена решённой" : "Жалоба отклонена");
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusyId(null);
        }
    }

    if (!canModerate) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <h2 className="text-xl font-bold">Доступ ограничен</h2>
                    <p className="mt-1 text-muted-foreground">Жалобы доступны только модераторам и администраторам.</p>
                    {!currentUser && (
                        <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                            Войти
                        </button>
                    )}
                </div>
            </section>
        );
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + pageSize, total);

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="grid gap-1">
                    <p className="text-xs font-extrabold uppercase text-primary">Модерация</p>
                    <h2 className="text-2xl font-bold">Жалобы на посты</h2>
                    <p className="text-muted-foreground">Рассмотрите жалобы: перейдите к посту и при необходимости отредактируйте или удалите его, затем закройте жалобу.</p>
                </div>
                <Link to="/moderation" className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-primary">
                    ← К очереди постов
                </Link>
            </div>

            <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                    <button
                        key={filter.value}
                        type="button"
                        onClick={() => {
                            setOffset(0);
                            setStatus(filter.value);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                            status === filter.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
                        }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {loading ? (
                <ListSkeleton count={6} />
            ) : items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">Жалоб нет.</p>
            ) : (
                <div className="grid gap-3">
                    {items.map((report) => (
                        <article key={report.id} className="grid gap-2 rounded-lg border border-border bg-card p-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">{statusLabels[report.status]}</span>
                                {report.openReportsForPost > 1 && status === "open" && (
                                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                                        ещё {report.openReportsForPost - 1} на этот пост
                                    </span>
                                )}
                                <Link to={`/posts/${report.postId}`} className="font-bold hover:text-primary">
                                    Пост #{report.postId}
                                </Link>
                                <span className="text-xs text-muted-foreground">автор: {report.postAuthorName ?? "—"}</span>
                                {report.postStatus !== "approved" && (
                                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">пост: {report.postStatus}</span>
                                )}
                            </div>

                            {report.postDescription && <p className="line-clamp-1 text-sm text-muted-foreground">«{report.postDescription}»</p>}

                            <p className="text-sm">
                                <span className="text-muted-foreground">Причина: </span>
                                <strong>{report.reason}</strong>
                            </p>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>от {report.reporterName ?? "—"}</span>
                                <span>{formatDate(report.createdAt)}</span>
                                {report.status !== "open" && report.resolvedByName && <span>обработал: {report.resolvedByName}</span>}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Link to={`/posts/${report.postId}/moderate`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                    Редактировать пост
                                </Link>
                                {report.status === "open" && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={busyId === report.id}
                                            onClick={() => void resolve(report, "resolved")}
                                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                                        >
                                            Закрыть (решена)
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyId === report.id}
                                            onClick={() => void resolve(report, "rejected")}
                                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                                        >
                                            Отклонить жалобу
                                        </button>
                                    </>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {total > pageSize && (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                        {from}–{to} из {total}
                    </span>
                    <div className="flex gap-2">
                        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">
                            Назад
                        </button>
                        <button type="button" disabled={to >= total} onClick={() => setOffset(offset + pageSize)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">
                            Вперёд
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
