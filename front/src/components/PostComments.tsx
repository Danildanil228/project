import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserAvatar } from "./UserAvatar";
import { ListSkeleton } from "./LoadingState";
import { addComment, deleteComment, listComments } from "../lib/engagement-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { CommentRow } from "../types/post";
import { formatDate, getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type PostCommentsProps = {
    postId: number;
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

export function PostComments({ postId, currentUser, adminContext, onOpenAuthModal }: PostCommentsProps) {
    const isModerator = hasElevatedUserAccess(currentUser, adminContext);
    const [comments, setComments] = useState<CommentRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState<number | null>(null);

    async function load() {
        setLoading(true);
        try {
            const response = await listComments(postId, { limit: 100 });
            setComments(response.items);
            setTotal(response.total);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!currentUser) {
            onOpenAuthModal();
            return;
        }
        const text = body.trim();
        if (!text) return;
        setSubmitting(true);
        setError("");
        try {
            const { comment } = await addComment(postId, text);
            setComments((previous) => [...previous, comment]);
            setTotal((value) => value + 1);
            setBody("");
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(comment: CommentRow) {
        setBusyId(comment.id);
        setError("");
        try {
            await deleteComment(postId, comment.id);
            setComments((previous) => previous.filter((item) => item.id !== comment.id));
            setTotal((value) => Math.max(0, value - 1));
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
            <h3 className="font-bold">Комментарии {total > 0 && <span className="text-muted-foreground">· {total}</span>}</h3>

            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {loading ? (
                <ListSkeleton count={3} leading />
            ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока нет комментариев — будьте первым.</p>
            ) : (
                <div className="grid gap-3">
                    {comments.map((comment) => {
                        const canDelete = isModerator || comment.authorId === currentUser?.id;
                        return (
                            <div key={comment.id} className="flex gap-2">
                                <Link to={`/posts/author/${comment.authorId}`} className="shrink-0">
                                    <UserAvatar user={{ name: comment.authorName ?? "", image: comment.authorImage, email: "" }} size="sm" />
                                </Link>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Link to={`/posts/author/${comment.authorId}`} className="text-sm font-bold hover:text-primary">
                                            {comment.authorName || "Пользователь"}
                                        </Link>
                                        <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                                        {canDelete && (
                                            <button
                                                type="button"
                                                disabled={busyId === comment.id}
                                                onClick={() => void remove(comment)}
                                                className="ml-auto text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                                            >
                                                Удалить
                                            </button>
                                        )}
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <form onSubmit={submit} className="grid gap-2">
                <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    onFocus={() => {
                        if (!currentUser) onOpenAuthModal();
                    }}
                    rows={2}
                    maxLength={2000}
                    placeholder={currentUser ? "Написать комментарий…" : "Войдите, чтобы комментировать"}
                    className="resize-y"
                />
                <button type="submit" disabled={submitting || !body.trim()} className="justify-self-start rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    {submitting ? "Отправка…" : "Отправить"}
                </button>
            </form>
        </div>
    );
}
