import { ChevronLeft, ChevronRight, LayoutGrid, Rows3, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { ItemCard } from "../components/ItemCard";
import { PageHeader } from "../components/PageHeader";
import { SelectMenu } from "../components/SelectMenu";
import { ItemDataTable } from "../features/items/ItemDataTable";
import { fetchItems, itemCategories, typeLabels, type CatalogItem, type ItemType } from "../lib/items-api";

type ViewMode = "cards" | "rows";
type SortDirection = "asc" | "desc";

type CatalogPageProps = {
    initialType: ItemType;
};

export function CatalogPage({ initialType }: CatalogPageProps) {
    const [type, setType] = useState<ItemType>(initialType);
    const [view, setView] = useState<ViewMode>(() => localStorage.getItem("catalog-view") === "rows" ? "rows" : "cards");
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch] = useDebounce(searchInput.trim(), 300);
    const [category, setCategory] = useState("");
    const [sortBy, setSortBy] = useState("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [offset, setOffset] = useState(0);
    const pageSize = view === "cards" ? 24 : 50;

    useEffect(() => {
        localStorage.setItem("catalog-view", view);
        setOffset(0);
    }, [view]);

    useEffect(() => {
        setType(initialType);
        setCategory("");
        setSearchInput("");
        setSortBy("name");
        setSortDirection("asc");
        setOffset(0);
    }, [initialType]);

    useEffect(() => {
        setOffset(0);
    }, [debouncedSearch]);

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
                <div className="inline-flex rounded-lg border border-border p-1" aria-label="Вид каталога">
                    <button type="button" onClick={() => setView("cards")} title="Карточками" className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${view === "cards" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><LayoutGrid size={15} /> Карточки</button>
                    <button type="button" onClick={() => setView("rows")} title="Строками" className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${view === "rows" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Rows3 size={15} /> Строки</button>
                </div>
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
                loading ? <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
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
