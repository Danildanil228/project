import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { ImageModal } from "../components/ImageModal";
import { Newspaper } from "lucide-react";
import { UserAvatar } from "../components/UserAvatar";
import { PostReactions } from "../components/PostReactions";
import { PostComments } from "../components/PostComments";
import { PostLocationView } from "../components/PostLocationView";
import { CatchTrophyBadge } from "../components/CatchTrophyBadge";
import { ReportButton } from "../components/ReportButton";
import { LoadingImage } from "../components/LoadingImage";
import { DetailSkeleton } from "../components/LoadingState";
import { mediaUrl } from "../lib/items-api";
import { getPinInfo, getPost, pinPost, recordPostView, removeModeratedPost, unpinPost } from "../lib/posts-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { postStatusLabels, type PostDetail } from "../types/post";
import { formatDate, getErrorMessage, isAdminUser, isModeratorUser, isSuperAdminUser } from "../utils/admin-format";

type PostDetailPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

function canModerate(user?: ManagedUser, ctx?: AdminSecurityContext | null) {
    return isAdminUser(user) || isModeratorUser(user) || isSuperAdminUser(user, ctx);
}

export function PostDetailPage({ currentUser, adminContext, onOpenAuthModal }: PostDetailPageProps) {
    const params = useParams();
    const navigate = useNavigate();
    const { confirm, dialog } = useConfirmDialog();
    const id = Number(params.id);
    const [post, setPost] = useState<PostDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Image gallery state.
    const [activeImage, setActiveImage] = useState(0);
    const [modalIndex, setModalIndex] = useState<number | null>(null);

    // Pin tier info (used / limit) — only fetched for moderators.
    const [pinInfo, setPinInfo] = useState<{ used: number; limit: number } | null>(null);
    const [pinBusy, setPinBusy] = useState(false);

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        setError("");
        getPost(id)
            .then((response) => {
                if (!ignore) {
                    setPost(response.post);
                    setActiveImage(0);
                }
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
    }, [id]);

    // Fetch pin counter so moderators see "2/3 закреплено" in the UI.
    useEffect(() => {
        if (!canModerate(currentUser, adminContext)) return;
        getPinInfo().then(setPinInfo).catch(() => undefined);
    }, [currentUser, adminContext]);

    async function togglePin() {
        if (!post) return;
        setPinBusy(true);
        setError("");
        try {
            if (post.pinnedAt) {
                await unpinPost(post.id);
                setPost({ ...post, pinnedAt: null });
            } else {
                await pinPost(post.id);
                setPost({ ...post, pinnedAt: new Date().toISOString() });
            }
            const info = await getPinInfo().catch(() => null);
            if (info) setPinInfo(info);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setPinBusy(false);
        }
    }

    // Per-session view counter — dedupe via sessionStorage so reloads/back+forward don't inflate.
    useEffect(() => {
        if (!post || post.status !== "approved") return;
        const key = `post-viewed:${post.id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        recordPostView(post.id).catch(() => undefined);
    }, [post]);

    async function handleRemove() {
        if (!post) return;
        const confirmed = await confirm({
            title: "Удалить пост",
            message: `Пост от ${post.authorName} будет скрыт от публики. Продолжить?`,
            confirmText: "Удалить",
            tone: "danger",
        });
        if (!confirmed) return;
        try {
            await removeModeratedPost(post.id);
            navigate("/feed");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    if (loading) return <DetailSkeleton />;

    if (error || !post) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
                    <p className="text-destructive">{error || "Пост не найден"}</p>
                    <Link to="/feed" className="mt-3 inline-block rounded-lg border border-border px-4 py-2 text-sm font-bold">
                        ← К ленте
                    </Link>
                </div>
            </section>
        );
    }

    const version = post.version;
    const photos = version?.media.map((item) => item.url) ?? [];
    const isOwner = currentUser?.id === post.authorId;
    const moderator = canModerate(currentUser, adminContext);
    const authorCanEdit = isOwner && (post.status === "draft" || post.status === "rejected");
    const moderatorCanEdit = moderator && !post.isCurated && (post.status === "approved" || post.status === "in_review");
    const curatedCanEdit = moderator && post.isCurated;
    const canEdit = authorCanEdit || moderatorCanEdit || curatedCanEdit;
    const editPath = moderatorCanEdit ? `/posts/${post.id}/moderate` : `/posts/${post.id}/edit`;

    return (
        <section className="grid gap-5">
            {/* Top bar: back + pin + status */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to="/feed" className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold hover:border-primary">
                    ← К ленте
                </Link>
                <div className="flex items-center gap-2">
                    {moderator && post.status === "approved" && (
                        <button
                            type="button"
                            disabled={pinBusy}
                            onClick={() => void togglePin()}
                            title={post.pinnedAt ? "Открепить" : "Закрепить пост в верху ленты"}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                                post.pinnedAt
                                    ? "border-amber-400 bg-amber-400/15 text-amber-700 dark:text-amber-400"
                                    : "border-border hover:border-amber-400"
                            }`}
                        >
                            <span aria-hidden="true">{post.pinnedAt ? "★" : "☆"}</span>
                            <span>{post.pinnedAt ? "Закреплён" : "Закрепить"}</span>
                            {pinInfo && <span className="text-xs font-normal opacity-70">{pinInfo.used}/{pinInfo.limit}</span>}
                        </button>
                    )}
                    {post.pinnedAt && !moderator && (
                        <span className="flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                            ★ Закреплён
                        </span>
                    )}
                    {post.status !== "approved" && (
                        <span className="rounded bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">{postStatusLabels[post.status]}</span>
                    )}
                </div>
            </div>

            {/* Two-column layout: gallery left, info right */}
            <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
                {/* Gallery */}
                <div className="grid content-start gap-2">
                    {photos.length > 0 ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setModalIndex(activeImage)}
                                className="block aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted"
                                aria-label="Открыть фото"
                            >
                                <LoadingImage src={mediaUrl(photos[activeImage])} alt="" className="h-full w-full" imageClassName="object-contain" />
                            </button>
                            {photos.length > 1 && (
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                                    {photos.map((url, index) => (
                                        <button
                                            key={url}
                                            type="button"
                                            onClick={() => setActiveImage(index)}
                                            className={`aspect-[4/3] min-w-0 overflow-hidden rounded-lg border transition-colors ${
                                                index === activeImage ? "border-primary" : "border-border hover:border-primary"
                                            }`}
                                            aria-label={`Фото ${index + 1}`}
                                        >
                                            <LoadingImage src={mediaUrl(url)} alt="" loading="lazy" className="h-full w-full" imageClassName="object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-border bg-muted text-5xl">
                            🎣
                        </div>
                    )}
                </div>

                {/* Info column */}
                <div className="grid content-start gap-3">
                    {/* Author. Curated posts show "Сообщество" without a profile link. */}
                    {post.isCurated || !post.authorId ? (
                        <div className="flex items-center gap-3">
                            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                                <Newspaper size={18} />
                            </span>
                            <div>
                                <strong className="block">Сообщество</strong>
                                {post.curatedLabel && <span className="block text-xs text-muted-foreground">{post.curatedLabel}</span>}
                                <span className="text-xs text-muted-foreground">{formatDate(post.publishedAt ?? post.createdAt)}</span>
                            </div>
                        </div>
                    ) : (
                        <Link to={`/posts/author/${post.authorId}`} className="flex items-center gap-3 hover:text-primary">
                            <UserAvatar user={{ name: post.authorName ?? "", image: post.authorImage, email: "" }} size="md" />
                            <div>
                                <strong className="block">{post.authorName}</strong>
                                <span className="text-xs text-muted-foreground">{formatDate(post.publishedAt ?? post.createdAt)}</span>
                            </div>
                        </Link>
                    )}

                    {/* Meta */}
                    <div className="grid gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                        {version?.waterbodyName && (
                            <div>
                                <span className="text-muted-foreground">Водоём: </span>
                                <strong>{version.waterbodyName}</strong>
                            </div>
                        )}
                        {version?.fishingMethod && (
                            <div>
                                <span className="text-muted-foreground">Вид ловли: </span>
                                <strong>{version.fishingMethod}</strong>
                            </div>
                        )}
                        {version?.point && (
                            <div>
                                <span className="text-muted-foreground">Точка: </span>
                                <strong className="font-mono">{version.point}</strong>
                            </div>
                        )}
                        {version?.income != null && (
                            <div>
                                <span className="text-muted-foreground">Заработано: </span>
                                <strong>{version.income.toLocaleString("ru-RU")} серебра</strong>
                            </div>
                        )}
                        {version?.incomePerHour != null && (
                            <div>
                                <span className="text-muted-foreground">В час: </span>
                                <strong>≈ {version.incomePerHour.toLocaleString("ru-RU")} серебра/час</strong>
                            </div>
                        )}
                        {post.status === "approved" && (
                            <div className="text-xs text-muted-foreground">👁 {post.viewCount} просмотров</div>
                        )}
                    </div>

                    {/* Author's map pin(s) — single point or A→B trolling range */}
                    {version?.waterbodyId != null && (version.mapX != null || version.mapX2 != null) && (
                        <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
                            <h3 className="text-sm font-bold">Карта</h3>
                            <PostLocationView
                                waterbodyId={version.waterbodyId}
                                mapX={version.mapX}
                                mapY={version.mapY}
                                mapX2={version.mapX2}
                                mapY2={version.mapY2}
                                gameCoordinateX={version.gameCoordinateX}
                                gameCoordinateY={version.gameCoordinateY}
                                gameCoordinateX2={version.gameCoordinateX2}
                                gameCoordinateY2={version.gameCoordinateY2}
                            />
                        </div>
                    )}

                    {/* Catches as badges */}
                    {version?.catches.length ? (
                        <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
                            <h3 className="text-sm font-bold">Улов</h3>
                            <div className="grid gap-1.5">
                                {version.catches.map((item) => {
                                    const catchBaits = version.baitMode === "common" ? version.commonBaits : item.baits;
                                    return (
                                        <div key={item.id} className="flex items-center gap-2 rounded-md bg-muted/70 px-2 py-1.5">
                                            {item.fishPhoto ? (
                                                <LoadingImage src={mediaUrl(item.fishPhoto)} alt={item.fishName} title={item.fishName} className="h-10 w-14 shrink-0 rounded border border-border bg-background" imageClassName="object-contain" />
                                            ) : (
                                                <div className="grid h-10 w-14 shrink-0 place-items-center rounded border border-border bg-background text-[10px] text-muted-foreground">Нет фото</div>
                                            )}
                                            <div className="min-w-0 text-sm">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <strong className="truncate">{item.fishName}</strong>
                                                    <CatchTrophyBadge type={item.trophyType} />
                                                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">{item.rarity}</span>
                                                </div>
                                                {catchBaits.length > 0 && (
                                                    <p className="line-clamp-2 text-xs text-muted-foreground" title={catchBaits.map((bait) => bait.name).join(", ")}>
                                                        <span className="font-medium text-foreground/80">Наживка или приманка:</span>{" "}
                                                        {catchBaits.map((bait) => bait.name).join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    {/* Description */}
                    {version?.description && (
                        <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
                            <h3 className="text-sm font-bold">Описание</h3>
                            <p className="whitespace-pre-wrap text-sm">{version.description}</p>
                        </div>
                    )}

                    {/* Moderator actions */}
                    {(canEdit || moderator) && (
                        <div className="flex flex-wrap gap-2">
                            {canEdit && (
                                <Link
                                    to={editPath}
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary"
                                >
                                    Редактировать
                                </Link>
                            )}
                            {moderator && (
                                <button
                                    type="button"
                                    onClick={() => void handleRemove()}
                                    className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                                >
                                    Удалить пост
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: reactions + report + comments — only on approved posts */}
            {post.status === "approved" && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <PostReactions postId={post.id} currentUser={currentUser} onOpenAuthModal={onOpenAuthModal} />
                        {/* Hide report on own post */}
                        {!isOwner && <ReportButton postId={post.id} currentUser={currentUser} onOpenAuthModal={onOpenAuthModal} />}
                    </div>
                    <PostComments postId={post.id} currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={onOpenAuthModal} />
                </>
            )}

            {modalIndex !== null && (
                <ImageModal urls={photos} index={modalIndex} onClose={() => setModalIndex(null)} onNavigate={setModalIndex} />
            )}

            {dialog}
        </section>
    );
}
