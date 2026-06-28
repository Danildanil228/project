import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PostCard } from "../components/PostCard";
import { UserAvatar } from "../components/UserAvatar";
import { CardGridSkeleton, Skeleton } from "../components/LoadingState";
import { getAuthorProfile } from "../lib/posts-api";
import type { AuthorProfile } from "../types/post";
import { formatDate, getErrorMessage } from "../utils/admin-format";

const pageSize = 12;

function roleLabel(role: string | string[] | null) {
    const text = Array.isArray(role) ? role.join(", ") : role ?? "user";
    return text === "user" ? "Рыболов" : text;
}

export function AuthorProfilePage() {
    const params = useParams();
    const authorId = params.authorId ?? "";
    const [data, setData] = useState<AuthorProfile | null>(null);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        setError("");
        getAuthorProfile(authorId, { limit: pageSize, offset })
            .then((response) => {
                if (!ignore) setData(response);
            })
            .catch((caught) => {
                if (!ignore) setError(getErrorMessage(caught));
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => {
            ignore = true;
        };
    }, [authorId, offset]);

    if (loading) return (
        <section className="grid gap-5" aria-busy="true">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                <Skeleton className="size-16 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64 max-w-full" /></div>
            </div>
            <CardGridSkeleton count={6} />
        </section>
    );

    if (error || !data) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
                    <p className="text-destructive">{error || "Автор не найден"}</p>
                    <Link to="/feed" className="mt-3 inline-block rounded-lg border border-border px-4 py-2 text-sm font-bold">
                        К ленте
                    </Link>
                </div>
            </section>
        );
    }

    const { author, stats, posts } = data;
    const from = stats.postCount === 0 ? 0 : offset + 1;
    const to = Math.min(offset + pageSize, stats.postCount);

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
                <UserAvatar user={{ name: author.name, image: author.image, email: "" }} size="lg" />
                <div className="grid gap-0.5">
                    <h2 className="text-2xl font-bold">{author.name}</h2>
                    <span className="text-sm text-muted-foreground">{roleLabel(author.role)} · на сайте с {formatDate(author.createdAt)}</span>
                </div>
                <div className="ml-auto flex gap-6 text-center">
                    <div>
                        <p className="text-2xl font-bold">{stats.postCount}</p>
                        <p className="text-xs text-muted-foreground">постов</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{stats.totalIncome.toLocaleString("ru-RU")}</p>
                        <p className="text-xs text-muted-foreground">серебра всего</p>
                    </div>
                </div>
            </div>

            {posts.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">У автора пока нет опубликованных постов</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))}
                </div>
            )}

            {stats.postCount > pageSize && (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                        {from}–{to} из {stats.postCount}
                    </span>
                    <div className="flex gap-2">
                        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">
                            Назад
                        </button>
                        <button type="button" disabled={to >= stats.postCount} onClick={() => setOffset(offset + pageSize)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">
                            Вперёд
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
