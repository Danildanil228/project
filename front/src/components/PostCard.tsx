import { useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { ImageModal } from "./ImageModal";
import { mediaUrl } from "../lib/items-api";
import type { FeedItem } from "../types/post";
import { timeAgo } from "../utils/admin-format";

type PostCardProps = {
    post: FeedItem;
};

export function PostCard({ post }: PostCardProps) {
    const [modalIndex, setModalIndex] = useState<number | null>(null);

    const hasPhotos = post.mediaUrls.length > 0;
    const secondaryPhotos = post.mediaUrls.slice(1);
    return (
        <article className={`flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary ${
            post.pinnedAt ? "border-amber-400/60 ring-1 ring-amber-400/30" : "border-border"
        }`}>
            {/* Photo collage */}
            <div className="relative bg-muted">
                {post.pinnedAt && (
                    <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950 shadow">
                        ★ Закреплён
                    </span>
                )}
                {hasPhotos ? (
                    <div className="grid gap-1 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setModalIndex(0)}
                            className="block aspect-[16/9] min-w-0 overflow-hidden"
                            aria-label="Открыть главное фото"
                        >
                            <img src={mediaUrl(post.mediaUrls[0])} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                        {secondaryPhotos.length > 0 && (
                            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(4, secondaryPhotos.length)}, minmax(0, 1fr))` }}>
                                {secondaryPhotos.map((url, index) => (
                                    <button
                                        key={`${url}-${index + 1}`}
                                        type="button"
                                        onClick={() => setModalIndex(index + 1)}
                                        className="block aspect-square min-h-0 w-full overflow-hidden"
                                        aria-label={`Открыть фото ${index + 2}`}
                                    >
                                        <img src={mediaUrl(url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <Link to={`/posts/${post.id}`} className="flex aspect-[4/3] w-full items-center justify-center text-5xl">
                        🎣
                    </Link>
                )}
            </div>

            <div className="flex flex-1 flex-col">
                <Link to={`/posts/${post.id}`} className="flex flex-1 flex-col gap-2 p-3 text-foreground hover:text-foreground">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        {post.waterbodyName && <span className="font-bold">{post.waterbodyName}</span>}
                        {post.fishingMethod && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{post.fishingMethod}</span>
                        )}
                        {post.point && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">📍 {post.point}</span>
                        )}
                    </div>

                    {post.fishNames.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {post.fishNames.slice(0, 6).map((name) => (
                                <span key={name} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                    {name}
                                </span>
                            ))}
                            {post.fishNames.length > 6 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{post.fishNames.length - 6}</span>
                            )}
                        </div>
                    )}

                    {post.description && <p className="line-clamp-2 text-sm text-muted-foreground">{post.description}</p>}

                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {post.incomePerHour != null && (
                            <span className="font-semibold text-foreground">≈ {post.incomePerHour.toLocaleString("ru-RU")}/ч</span>
                        )}
                        <span title="Лайки">👍 {post.likes}</span>
                        <span title="Дизлайки">👎 {post.dislikes}</span>
                        <span title="Просмотры">👁 {post.viewCount}</span>
                    </div>
                </Link>

                <div className="flex items-center justify-between gap-2 border-t border-border p-3 pt-2">
                    {post.isCurated || !post.authorId ? (
                        <div className="flex min-w-0 items-center gap-2" title="Пост от сообщества">
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                                <Newspaper size={13} />
                            </span>
                            <div className="grid leading-tight">
                                <span className="truncate text-sm font-semibold">Сообщество</span>
                                {post.curatedLabel && <span className="truncate text-[10px] text-muted-foreground">{post.curatedLabel}</span>}
                            </div>
                        </div>
                    ) : (
                        <Link to={`/posts/author/${post.authorId}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
                            <UserAvatar user={{ name: post.authorName ?? "", image: post.authorImage, email: "" }} size="sm" />
                            <span className="truncate text-sm">{post.authorName}</span>
                        </Link>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(post.publishedAt)}</span>
                </div>
            </div>

            {modalIndex !== null && (
                <ImageModal urls={post.mediaUrls} index={modalIndex} onClose={() => setModalIndex(null)} onNavigate={setModalIndex} />
            )}
        </article>
    );
}
