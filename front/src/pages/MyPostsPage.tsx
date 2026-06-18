import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { mediaUrl } from "../lib/items-api";
import { deletePost, listMyPosts, submitPost } from "../lib/posts-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { postStatusLabels, type MyPostRow, type PostStatus } from "../types/post";
import { formatDate, getErrorMessage } from "../utils/admin-format";

type MyPostsPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

const pageSize = 20;

const statusFilters: { value: PostStatus | ""; label: string }[] = [
    { value: "", label: "Все" },
    { value: "draft", label: "Черновики" },
    { value: "pending", label: "Ожидают" },
    { value: "in_review", label: "На модерации" },
    { value: "approved", label: "Опубликованы" },
    { value: "rejected", label: "Отклонены" },
    { value: "deleted", label: "Удалённые" },
];

const statusBadgeClass: Record<PostStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    in_review: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    approved: "bg-green-500/15 text-green-700 dark:text-green-400",
    rejected: "bg-destructive/15 text-destructive",
    deleted: "bg-muted text-muted-foreground line-through",
};

export function MyPostsPage({ currentUser, adminContext: _adminContext, onOpenAuthModal }: MyPostsPageProps) {
    const { confirm, dialog } = useConfirmDialog();
    const [status, setStatus] = useState<PostStatus | "">("");
    const [items, setItems] = useState<MyPostRow[]>([]);
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
            const response = await listMyPosts({ status, limit: pageSize, offset });
            setItems(response.items);
            setTotal(response.total);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (currentUser) void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id, status, offset]);

    function changeStatus(next: PostStatus | "") {
        setOffset(0);
        setStatus(next);
    }

    async function handleSubmit(id: number) {
        setBusyId(id);
        setNotice("");
        setError("");
        try {
            await submitPost(id);
            setNotice("Пост отправлен на проверку");
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusyId(null);
        }
    }

    async function handleDelete(row: MyPostRow) {
        const confirmed = await confirm({
            title: "Удалить пост",
            message: "Пост будет удалён безвозвратно. Продолжить?",
            confirmText: "Удалить",
            tone: "danger",
        });
        if (!confirmed) return;
        setBusyId(row.id);
        setNotice("");
        setError("");
        try {
            await deletePost(row.id);
            setNotice("Пост удалён");
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusyId(null);
        }
    }

    if (!currentUser) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <h2 className="text-xl font-bold">Нужен вход</h2>
                    <p className="mt-1 text-muted-foreground">Войдите, чтобы видеть и создавать свои посты.</p>
                    <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                        Войти
                    </button>
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
                    <p className="text-xs font-extrabold uppercase text-primary">Посты</p>
                    <h2 className="text-2xl font-bold">Мои посты</h2>
                    <p className="text-muted-foreground">Черновики, отправленные на проверку и опубликованные посты.</p>
                </div>
                <Link to="/posts/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    + Создать пост
                </Link>
            </div>

            <div className="flex flex-wrap gap-2">
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
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {loading ? (
                <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
            ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                    <p>Постов пока нет.</p>
                    <Link to="/posts/new" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                        Создать первый пост
                    </Link>
                </div>
            ) : (
                <div className="grid gap-3">
                    {items.map((row) => {
                        const editable = row.status === "draft" || row.status === "rejected";
                        const deletable = row.status !== "approved";
                        return (
                            <article key={row.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                                    {row.coverUrl ? (
                                        <img src={mediaUrl(row.coverUrl)} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="flex h-full w-full items-center justify-center text-2xl">🎣</span>
                                    )}
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${statusBadgeClass[row.status]}`}>{postStatusLabels[row.status]}</span>
                                        {row.waterbodyName && <span className="text-sm font-semibold">{row.waterbodyName}</span>}
                                        <span className="text-xs text-muted-foreground">{formatDate(row.publishedAt ?? row.createdAt)}</span>
                                    </div>
                                    <p className="line-clamp-2 text-sm text-muted-foreground">{row.description?.trim() || "Без описания"}</p>
                                    {row.status === "rejected" && row.rejectionReason && (
                                        <p className="text-xs text-destructive">Причина отклонения: {row.rejectionReason}</p>
                                    )}

                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {row.status === "approved" && (
                                            <Link to={`/posts/${row.id}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                                Открыть
                                            </Link>
                                        )}
                                        {editable && (
                                            <>
                                                <Link to={`/posts/${row.id}/edit`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                                    Редактировать
                                                </Link>
                                                <button
                                                    type="button"
                                                    disabled={busyId === row.id}
                                                    onClick={() => void handleSubmit(row.id)}
                                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                                                >
                                                    Отправить на проверку
                                                </button>
                                            </>
                                        )}
                                        {deletable && (
                                            <button
                                                type="button"
                                                disabled={busyId === row.id}
                                                onClick={() => void handleDelete(row)}
                                                className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                            >
                                                Удалить
                                            </button>
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
