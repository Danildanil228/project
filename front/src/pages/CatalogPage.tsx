import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { ItemCard } from "../components/ItemCard";
import { PageHeader } from "../components/PageHeader";
import { SelectMenu } from "../components/SelectMenu";
import { CatalogViewToggle, useCatalogView } from "../components/CatalogViewToggle";
import { CardGridSkeleton } from "../components/LoadingState";
import { ItemDataTable } from "../features/items/ItemDataTable";
import { fetchItems, itemCategories, typeLabels, type CatalogItem, type ItemType } from "../lib/items-api";

type SortDirection = "asc" | "desc";

type CatalogPageProps = {
    initialType: ItemType;
};

type StoredCatalogState = {
    searchInput: string;
    category: string;
    sortBy: string;
    sortDirection: SortDirection;
    offset: number;
};

const defaultCatalogState: StoredCatalogState = {
    searchInput: "",
    category: "",
    sortBy: "name",
    sortDirection: "asc",
    offset: 0,
};

function readCatalogState(type: ItemType): StoredCatalogState {
    try {
        const stored = sessionStorage.getItem(`catalog-state-${type}`);
        return stored ? { ...defaultCatalogState, ...JSON.parse(stored) as Partial<StoredCatalogState> } : defaultCatalogState;
    } catch {
        return defaultCatalogState;
    }
}

export function CatalogPage({ initialType }: CatalogPageProps) {
    const [initialState] = useState(() => readCatalogState(initialType));
    const [type, setType] = useState<ItemType>(initialType);
    const [view, setView] = useCatalogView();
    const [searchInput, setSearchInput] = useState(initialState.searchInput);
    const [debouncedSearch] = useDebounce(searchInput.trim(), 300);
    const [category, setCategory] = useState(initialState.category);
    const [sortBy, setSortBy] = useState(initialState.sortBy);
    const [sortDirection, setSortDirection] = useState<SortDirection>(initialState.sortDirection);
    const [offset, setOffset] = useState(initialState.offset);
    const pageSize = view === "cards" ? 24 : 50;
    const previousView = useRef(view);
    const previousSearch = useRef(debouncedSearch);

    useEffect(() => {
        if (previousView.current !== view) setOffset(0);
        previousView.current = view;
    }, [view]);

    useEffect(() => {
        const stored = readCatalogState(initialType);
        setType(initialType);
        setCategory(stored.category);
        setSearchInput(stored.searchInput);
        setSortBy(stored.sortBy);
        setSortDirection(stored.sortDirection);
        setOffset(stored.offset);
    }, [initialType]);

    useEffect(() => {
        if (previousSearch.current !== debouncedSearch) setOffset(0);
        previousSearch.current = debouncedSearch;
    }, [debouncedSearch]);

    useEffect(() => {
        try {
            sessionStorage.setItem(`catalog-state-${type}`, JSON.stringify({ searchInput, category, sortBy, sortDirection, offset }));
        } catch {
            // Navigation still works when storage is unavailable; only restoration is skipped.
        }
    }, [category, offset, searchInput, sortBy, sortDirection, type]);

    // react-query dedupes identical concurrent fetches (StrictMode mounts share the cache),
    // keeps previous data while a new page loads (no flicker on pagination), and caches results for 30s.
    const { data, isFetching, error: queryError } = useQuery({
        queryKey: ["catalog", type, { search: debouncedSearch, category, sortBy, sortDirection, limit: pageSize, offset }],
        queryFn: () => fetchItems(type, { search: debouncedSearch, category, sortBy, sortDirection, limit: pageSize, offset }),
        placeholderData: keepPreviousData,
    });
    const items = (data?.items ?? []) as CatalogItem[];
    const total = data?.total ?? 0;
    const loading = isFetching;
    const error = queryError instanceof Error ? queryError.message : "";

    function applySearch(event: FormEvent) {
        event.preventDefault();
        setOffset(0);
    }

    function changeSort(field: string) {
        setOffset(0);
        if (sortBy === field) setSortDirection((current) => current === "asc" ? "desc" : "asc");
        else {
            setSortBy(field);
            setSortDirection("asc");
        }
    }

    function clearFilters() {
        setSearchInput("");
        setCategory("");
        setOffset(0);
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + pageSize, total);
    const hasFilters = Boolean(debouncedSearch || category);

    return (
        <section className="grid gap-5">
            <PageHeader
                eyebrow="Справочник"
                title={typeLabels[type]}
                description="Внутриигровые снасти с полными характеристиками."
            />

            <Link to="/catalog" className="w-fit text-sm font-bold text-primary hover:underline">← К каталогу</Link>

            <div className="flex justify-end">
                <CatalogViewToggle value={view} onChange={setView} />
            </div>

            <form onSubmit={applySearch} className="grid gap-3 border-y border-border py-4 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto] lg:items-end">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Поиск по всем характеристикам</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Название, бренд, тест, механизм…" /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Категория</span><SelectMenu value={category} onChange={(value) => { setOffset(0); setCategory(value); }} options={[{ value: "", label: "Все категории" }, ...itemCategories[type].map((value) => ({ value, label: value }))]} /></label>
                {view === "cards" ? (
                    <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Сортировка</span><SelectMenu value={`${sortBy}:${sortDirection}`} onChange={(value) => { const [field, direction] = value.split(":"); setSortBy(field); setSortDirection(direction as SortDirection); setOffset(0); }} options={[{ value: "name:asc", label: "Название А→Я" }, { value: "name:desc", label: "Название Я→А" }, { value: "brend:asc", label: "Бренд А→Я" }, { value: "lvl:asc", label: "Уровень ↑" }, { value: "lvl:desc", label: "Уровень ↓" }]} /></label>
                ) : <div className="hidden lg:block" />}
                <button type="button" onClick={clearFilters} disabled={!hasFilters} title="Сбросить фильтры" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-40"><X size={16} /> Сбросить</button>
            </form>

            {view === "rows" && <p className="text-sm text-muted-foreground">Нажмите заголовок столбца для сортировки.</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {view === "cards" ? (
                loading ? <CardGridSkeleton count={8} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
                    : items.length === 0 ? <p className="py-10 text-center text-muted-foreground">Ничего не найдено</p>
                        : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <ItemCard key={item.id} type={type} item={item} />)}</div>
            ) : (
                <ItemDataTable type={type} rows={items} loading={loading} sortBy={sortBy} sortDirection={sortDirection} onSort={changeSort} />
            )}

            {total > pageSize && (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">{from}–{to} из {total}</span>
                    <div className="flex gap-2"><button type="button" title="Предыдущая страница" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - pageSize))} className="grid size-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" title="Следующая страница" disabled={to >= total || loading} onClick={() => setOffset(offset + pageSize)} className="grid size-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={16} /></button></div>
                </div>
            )}
        </section>
    );
}
