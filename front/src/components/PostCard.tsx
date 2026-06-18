import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { UserAvatar } from "./UserAvatar";
import { ImageModal } from "./ImageModal";
import { mediaUrl } from "../lib/items-api";
import type { FeedItem } from "../types/post";
import { timeAgo } from "../utils/admin-format";

type PostCardProps = {
    post: FeedItem;
};

export function PostCard({ post }: PostCardProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [modalIndex, setModalIndex] = useState<number | null>(null);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on("select", onSelect);
        onSelect();
    }, [emblaApi, onSelect]);

    const hasPhotos = post.mediaUrls.length > 0;
    const showMultiple = post.mediaUrls.length > 1;

    return (
        <article className={`flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary ${
            post.pinnedAt ? "border-amber-400/60 ring-1 ring-amber-400/30" : "border-border"
        }`}>
            {/* Photo carousel */}
            <div className="relative bg-muted">
                {post.pinnedAt && (
                    <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950 shadow">
                        ★ Закреплён
                    </span>
                )}
                {hasPhotos ? (
                    <>
                        <div ref={emblaRef} className="overflow-hidden">
                            <div className="flex">
                                {post.mediaUrls.map((url, index) => (
                                    <div key={url} className="min-w-0 flex-[0_0_100%]">
                                        <button
                                            type="button"
                                            onClick={() => setModalIndex(index)}
                                            className="block w-full"
                                            aria-label="Открыть фото"
                                        >
                                            <img src={mediaUrl(url)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {showMultiple && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => emblaApi?.scrollPrev()}
                                    aria-label="Назад"
                                    className="absolute left-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-xl text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60 sm:flex sm:opacity-70"
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    onClick={() => emblaApi?.scrollNext()}
                                    aria-label="Вперёд"
                                    className="absolute right-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-xl text-white sm:flex sm:opacity-70 hover:bg-black/60"
                                >
                                    ›
                                </button>
                                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                                    {post.mediaUrls.map((_, index) => (
                                        <span
                                            key={index}
                                            className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                                index === selectedIndex ? "bg-white" : "bg-white/40"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <div className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
                                    {selectedIndex + 1}/{post.mediaUrls.length}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <Link to={`/posts/${post.id}`} className="flex aspect-[4/3] w-full items-center justify-center text-5xl">
                        🎣
                    </Link>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {post.waterbodyName && (
                        <Link to={`/posts/${post.id}`} className="font-bold hover:text-primary">
                            {post.waterbodyName}
                        </Link>
                    )}
                    {post.fishingMethod && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{post.fishingMethod}</span>
                    )}
                    {post.point && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">📍 {post.point}</span>
                    )}
                </div>

                {/* Catch badges (just names) */}
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

                {/* Description — click goes to detail */}
                {post.description && (
                    <Link to={`/posts/${post.id}`} className="line-clamp-2 text-sm text-muted-foreground hover:text-foreground">
                        {post.description}
                    </Link>
                )}

                {/* Metrics row */}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {post.incomePerHour != null && (
                        <span className="font-semibold text-foreground">≈ {post.incomePerHour.toLocaleString("ru-RU")}/ч</span>
                    )}
                    <span title="Лайки">👍 {post.likes}</span>
                    <span title="Дизлайки">👎 {post.dislikes}</span>
                    <span title="Просмотры">👁 {post.viewCount}</span>
                </div>

                {/* Author + time */}
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                    <Link to={`/posts/author/${post.authorId}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
                        <UserAvatar user={{ name: post.authorName, image: post.authorImage, email: "" }} size="sm" />
                        <span className="truncate text-sm">{post.authorName}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(post.publishedAt)}</span>
                </div>
            </div>

            {modalIndex !== null && (
                <ImageModal urls={post.mediaUrls} index={modalIndex} onClose={() => setModalIndex(null)} onNavigate={setModalIndex} />
            )}
        </article>
    );
}
