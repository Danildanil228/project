import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { mediaUrl } from "../lib/items-api";
import { approvePost, claimPost, listModerationQueue, rejectPost, releasePost, removeModeratedPost } from "../lib/posts-api";
import { reportsOpenCount } from "../lib/engagement-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { ModerationQueueRow } from "../types/post";
import { formatDate, getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type ModerationQueuePageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

const pageSize = 20;

const statusFilters: { value: "pending" | "in_review" | ""; label: string }[] = [
    { value: "", label: "Все" },
    { value: "pending", label: "Ожидают" },
    { value: "in_review", label: "Взяты в работу" },
];

function relativeMinutes(iso: string | null) {
    if (!iso) return null;
    const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
    if (seconds < 60) return "только что";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    return `${Math.floor(hours / 24)} д назад`;
}

export function ModerationQueuePage({ currentUser, adminContext, onOpenAuthModal }: ModerationQueuePageProps) {
    const canModerate = hasElevatedUserAccess(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [status, setStatus] = useState<"pending" | "in_review" | "">("");
    const [items, setItems] = useState<ModerationQueueRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [openReports, setOpenReports] = useState(0);

    async function load() {
        setLoading(true);
        setError("");
        try {
            const response = await listModerationQueue({ status, limit: pageSize, offset });
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

    useEffect(() => {
        if (canModerate) reportsOpenCount().then(({ open }) => setOpenReports(open)).catch(() => undefined);
    }, [canModerate]);

    function changeStatus(next: "pending" | "in_review" | "") {
        setOffset(0);
        setStatus(next);
    }

    async function runAction(id: number, action: () => Promise<unknown>, successMessage: string) {
        setBusyId(id);
        setNotice("");
        setError("");
        try {
            await action();
            setNotice(successMessage);
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusyId(null);
        }
    }

    async function submitReject(id: number) {
        const reason = rejectReason.trim();
        if (!reason) {
            setError("Укажите причину отклонения");
            return;
        }
        setBusyId(id);
        setNotice("");
        setError("");
        try {
            await rejectPost(id, reason);
            setNotice("Пост отклонён");
            setRejectingId(null);
            setRejectReason("");
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusyId(null);
        }
    }

    async function handleRemove(row: ModerationQueueRow) {
        const confirmed = await confirm({
            title: "Удалить пост",
            message: `Пост от ${row.authorName} будет удалён (скрыт от публики). Продолжить?`,
            confirmText: "Удалить",
            tone: "danger",
        });
        if (!confirmed) return;
        await runAction(row.id, () => removeModeratedPost(row.id), "Пост удалён");
    }

    if (!canModerate) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <h2 className="text-xl font-bold">Доступ ограничен</h2>
                    <p className="mt-1 text-muted-foreground">Очередь модерации доступна только модераторам и администраторам.</p>
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
                    <h2 className="text-2xl font-bold">Очередь постов</h2>
                    <p className="text-muted-foreground">Возьмите пост в работу, чтобы одобрить, отклонить или отредактировать. «Захват» снимается автоматически через 20 минут бездействия.</p>
                </div>
                <Link to="/moderation/reports" className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-primary">
                    Жалобы{openReports > 0 && <span className="ml-1 rounded bg-destructive px-1.5 text-xs text-destructive-foreground">{openReports}</span>}
                </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {statusFilters.map((filter) => (
                    <button
                        key={filter.value || "all"}
                        type="button"
                        onClick={() => changeStatus(filter.value)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                            status === filter.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
                        }`}
                    >
                        {filter.label}
                    </button>
                ))}
                <button type="button" onClick={() => void load()} className="ml-auto rounded-lg border border-border px-3 py-1.5 text-sm font-bold hover:border-primary">
                    Обновить
                </button>
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {loading ? (
                <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
            ) : items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">Очередь пуста — все посты разобраны.</p>
            ) : (
                <div className="grid gap-3">
                    {items.map((row) => {
                        const claimedByMe = row.claimedById === currentUser?.id;
                        const claimedByOther = Boolean(row.claimedById && !claimedByMe && !row.claimExpired);
                        const isRejecting = rejectingId === row.id;

                        return (
                            <article key={row.id} className="rounded-lg border border-border bg-card p-3">
                                <div className="flex gap-3">
                                    <Link to={`/posts/${row.id}`} className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                                        {row.coverUrl ? (
                                            <img src={mediaUrl(row.coverUrl)} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-2xl">🎣</span>
                                        )}
                                    </Link>

                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {row.status === "pending" ? (
                                                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">Ожидает</span>
                                            ) : (
                                                <span className="rounded bg-blue-500/15 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                                                    На модерации{row.claimedByName ? ` — ${row.claimedByName}` : ""}
                                                </span>
                                            )}
                                            {row.claimExpired && row.claimedById && (
                                                <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">Захват просрочен</span>
                                            )}
                                            {row.resubmitCount > 0 && (
                                                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Переотправлен {row.resubmitCount}×</span>
                                            )}
                                            {row.waterbodyName && <span className="text-sm font-bold">{row.waterbodyName}</span>}
                                            {row.fishingMethod && <span className="text-xs text-muted-foreground">{row.fishingMethod}</span>}
                                        </div>

                                        <p className="line-clamp-2 text-sm text-muted-foreground">{row.description?.trim() || "Без описания"}</p>

                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <Link to={`/posts/author/${row.authorId}`} className="hover:text-primary">
                                                Автор: <strong className="text-foreground">{row.authorName}</strong>
                                            </Link>
                                            <span>🐟 {row.catchCount}</span>
                                            <span>обновлён {relativeMinutes(row.updatedAt) ?? formatDate(row.updatedAt)}</span>
                                            {row.claimedAt && <span>взят {relativeMinutes(row.claimedAt) ?? "только что"}</span>}
                                        </div>

                                        {isRejecting ? (
                                            <div className="mt-2 grid gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                                                <label className="grid gap-1 text-sm">
                                                    <span className="text-muted-foreground">Причина отклонения *</span>
                                                    <textarea
                                                        value={rejectReason}
                                                        onChange={(event) => setRejectReason(event.target.value)}
                                                        rows={2}
                                                        maxLength={500}
                                                        placeholder="Например: нерелевантное содержимое"
                                                        className="resize-y"
                                                    />
                                                </label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={busyId === row.id}
                                                        onClick={() => void submitReject(row.id)}
                                                        className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-50"
                                                    >
                                                        Отклонить
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRejectingId(null);
                                                            setRejectReason("");
                                                        }}
                                                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                                                    >
                                                        Отмена
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                <Link to={`/posts/${row.id}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                                    Открыть
                                                </Link>

                                                {!claimedByMe && (
                                                    <button
                                                        type="button"
                                                        disabled={busyId === row.id || claimedByOther}
                                                        onClick={() => void runAction(row.id, () => claimPost(row.id), claimedByOther ? "" : "Взято в работу")}
                                                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                                                        title={claimedByOther ? `Уже взято: ${row.claimedByName ?? ""}` : ""}
                                                    >
                                                        {claimedByOther ? "Уже взято" : row.claimExpired ? "Перехватить" : "Взять в работу"}
                                                    </button>
                                                )}

                                                {claimedByMe && (
                                                    <>
                                                        <Link to={`/posts/${row.id}/moderate`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                                            Редактировать
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            disabled={busyId === row.id}
                                                            onClick={() => void runAction(row.id, () => approvePost(row.id), "Пост одобрен")}
                                                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                                                        >
                                                            Одобрить
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busyId === row.id}
                                                            onClick={() => {
                                                                setRejectingId(row.id);
                                                                setRejectReason("");
                                                            }}
                                                            className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                                                        >
                                                            Отклонить…
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busyId === row.id}
                                                            onClick={() => void runAction(row.id, () => releasePost(row.id), "Отложено — вернётся в очередь")}
                                                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                                                        >
                                                            Отложить
                                                        </button>
                                                    </>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={busyId === row.id}
                                                    onClick={() => void handleRemove(row)}
                                                    className="ml-auto rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                                                >
                                                    Удалить пост
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
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
            {dialog}
        </section>
    );
}
