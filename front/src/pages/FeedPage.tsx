import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PenSquare } from "lucide-react";
import { useDebounce } from "use-debounce";
import { MultiSelectFilter, type MultiSelectOption } from "../components/MultiSelectFilter";
import { PageHeader } from "../components/PageHeader";
import { PostCard } from "../components/PostCard";
import { CardGridSkeleton, LoadingSpinner } from "../components/LoadingState";
import { SelectMenu } from "../components/SelectMenu";
import { listFish, listWaterbodies } from "../lib/reference-api";
import { listFeed } from "../lib/posts-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { fishingMethods, type FeedItem, type FeedSort, type FeedTrophyFilter, type FishingMethod } from "../types/post";
import { getErrorMessage } from "../utils/admin-format";

type FeedPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
};

const pageSize = 12;
type Columns = 1 | 2 | 3;

const gridClass: Record<Columns, string> = {
    1: "grid grid-cols-1 gap-3",
    2: "grid grid-cols-1 gap-3 md:grid-cols-2",
    3: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
};

export function FeedPage({ currentUser }: FeedPageProps) {
    const [allFish, setAllFish] = useState<MultiSelectOption[]>([]);
    const [allWaterbodies, setAllWaterbodies] = useState<MultiSelectOption[]>([]);

    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch] = useDebounce(searchInput, 300);
    const [fishIds, setFishIds] = useState<number[]>([]);
    const [waterbodyIds, setWaterbodyIds] = useState<number[]>([]);
    const [method, setMethod] = useState<FishingMethod | "">("");
    const [trophyType, setTrophyType] = useState<FeedTrophyFilter>("");
    const [sortBy, setSortBy] = useState<FeedSort>("date");
    const [columns, setColumns] = useState<Columns>(3);

    const [items, setItems] = useState<FeedItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ignore = false;
        Promise.all([listFish({ limit: 500 }), listWaterbodies({ limit: 200 })])
            .then(([fish, water]) => {
                if (ignore) return;
                setAllFish(fish.items.map((item) => ({ id: item.id, name: item.name, hint: item.rarity })));
                setAllWaterbodies(water.items.map((item) => ({ id: item.id, name: item.name })));
            })
            .catch(() => undefined);
        return () => {
            ignore = true;
        };
    }, []);

    // Stable filter key — used to reset accumulated items when filters change.
    const filterKey = JSON.stringify({ debouncedSearch, fishIds, waterbodyIds, method, trophyType, sortBy });

    const fetchPage = useCallback(
        async (currentOffset: number, replace: boolean) => {
            setLoading(true);
            setError("");
            try {
                const response = await listFeed({
                    search: debouncedSearch,
                    fishIds,
                    waterbodyIds,
                    fishingMethod: method,
                    trophyType,
                    sortBy,
                    limit: pageSize,
                    offset: currentOffset,
                });
                setItems((previous) => (replace ? response.items : [...previous, ...response.items]));
                setTotal(response.total);
            } catch (caught) {
                setError(getErrorMessage(caught));
            } finally {
                setLoading(false);
            }
        },
        [debouncedSearch, fishIds, waterbodyIds, method, trophyType, sortBy],
    );

    // Whenever filters change: clear list and fetch page 1.
    useEffect(() => {
        setItems([]);
        setTotal(0);
        void fetchPage(0, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    // Infinite scroll: load next page when sentinel comes into view.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loading && items.length < total) {
                    void fetchPage(items.length, false);
                }
            },
            { rootMargin: "200px" },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [items.length, total, loading, fetchPage]);

    function resetAll() {
        setSearchInput("");
        setFishIds([]);
        setWaterbodyIds([]);
        setMethod("");
        setTrophyType("");
        setSortBy("date");
    }

    const hasActiveFilters =
        debouncedSearch || fishIds.length > 0 || waterbodyIds.length > 0 || method !== "" || trophyType !== "" || sortBy !== "date";

    return (
        <section className="grid gap-5">
            <PageHeader
                eyebrow="Сообщество"
                title="Лента постов"
                description="Уловы, трофеи и точки клёва от игроков. Доступно без входа."
                actions={
                    <Link
                        to={currentUser ? "/posts/new" : "/posts"}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
                    >
                        <PenSquare size={15} /> Создать пост
                    </Link>
                }
            />

            <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
                <div className="grid gap-3 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(16rem,1fr)_11rem_11rem_12rem]">
                    <label className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">Поиск — по описанию, точке, водоёму, рыбе</span>
                        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Например, трофей пикша" />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">Трофейность</span>
                        <SelectMenu
                            value={trophyType}
                            onChange={(value) => setTrophyType(value as FeedTrophyFilter)}
                            options={[
                                { value: "", label: "Любой улов" },
                                { value: "trophy", label: "Трофей" },
                                { value: "rare_trophy", label: "Супертрофей" },
                            ]}
                        />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">Вид ловли</span>
                        <SelectMenu value={method} onChange={(value) => setMethod(value as FishingMethod | "")} options={[{ value: "", label: "Все" }, ...fishingMethods.map((value) => ({ value, label: value }))]} />
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">Сортировка</span>
                        <SelectMenu value={sortBy} onChange={(value) => setSortBy(value as FeedSort)} options={[{ value: "date", label: "Сначала новые" }, { value: "incomePerHour", label: "По заработку в час" }]} />
                    </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <MultiSelectFilter label="Рыбы" options={allFish} selected={fishIds} onChange={setFishIds} searchPlaceholder="Поиск рыбы…" />
                    <MultiSelectFilter label="Водоёмы" options={allWaterbodies} selected={waterbodyIds} onChange={setWaterbodyIds} searchPlaceholder="Поиск водоёма…" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    {/* Column count toggle — mirrors the catalog page UX */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Колонок:</span>
                        {([1, 2, 3] as Columns[]).map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setColumns(value)}
                                className={`h-8 w-8 rounded-lg text-sm font-bold transition-colors ${
                                    columns === value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
                                }`}
                                aria-label={`${value} в ряд`}
                            >
                                {value}
                            </button>
                        ))}
                    </div>

                    {hasActiveFilters && (
                        <button type="button" onClick={resetAll} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-destructive hover:text-destructive">
                            ✕ Сбросить фильтры
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {loading && items.length === 0 ? (
                <CardGridSkeleton count={6} className={gridClass[columns].replace("grid ", "")} />
            ) : !loading && items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                    <p>Постов не найдено</p>
                    {hasActiveFilters && (
                        <button type="button" onClick={resetAll} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                            Сбросить фильтры
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className={gridClass[columns]}>
                        {items.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>

                    {/* Sentinel for infinite scroll — observed by IntersectionObserver. */}
                    <div ref={sentinelRef} className="flex items-center justify-center pt-2">
                        {loading && items.length > 0 && <LoadingSpinner label="Загружаю ещё" size={16} />}
                        {!loading && items.length >= total && total > 0 && (
                            <span className="text-xs text-muted-foreground">Показано {items.length} из {total}</span>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
