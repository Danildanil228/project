import { ChevronLeft, ChevronRight, LayoutGrid, Rows3, Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ItemCard } from "../components/ItemCard";
import { ItemDataTable } from "../features/items/ItemDataTable";
import { fetchItems, itemCategories, typeLabels, type CatalogItem, type ItemType } from "../lib/items-api";

type ViewMode = "cards" | "rows";
type SortDirection = "asc" | "desc";

const itemTypes: ItemType[] = ["reels", "rods"];

export function CatalogPage() {
    const [type, setType] = useState<ItemType>("reels");
    const [view, setView] = useState<ViewMode>(() => localStorage.getItem("catalog-view") === "rows" ? "rows" : "cards");
    const [searchInput, setSearchInput] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [category, setCategory] = useState("");
    const [sortBy, setSortBy] = useState("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [offset, setOffset] = useState(0);
    const pageSize = view === "cards" ? 24 : 50;

    useEffect(() => {
        localStorage.setItem("catalog-view", view);
        setOffset(0);
    }, [view]);

    // react-query dedupes identical concurrent fetches (StrictMode mounts share the cache),
    // keeps previous data while a new page loads (no flicker on pagination), and caches results for 30s.
    const { data, isFetching, error: queryError } = useQuery({
        queryKey: ["catalog", type, { search: appliedSearch, category, sortBy, sortDirection, limit: pageSize, offset }],
        queryFn: () => fetchItems(type, { search: appliedSearch, category, sortBy, sortDirection, limit: pageSize, offset }),
        placeholderData: keepPreviousData,
    });
    const items = (data?.items ?? []) as CatalogItem[];
    const total = data?.total ?? 0;
    const loading = isFetching;
    const error = queryError instanceof Error ? queryError.message : "";

    function changeType(next: ItemType) {
        if (next === type) return;
        setType(next);
        setCategory("");
        setSearchInput("");
        setAppliedSearch("");
        setSortBy("name");
        setSortDirection("asc");
        setOffset(0);
    }

    function applySearch(event: FormEvent) {
        event.preventDefault();
        setOffset(0);
        setAppliedSearch(searchInput.trim());
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
        setAppliedSearch("");
        setCategory("");
        setOffset(0);
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + pageSize, total);
    const hasFilters = Boolean(appliedSearch || category);

    return (
        <section className="grid gap-5">
            <div className="grid gap-1">
                <p className="text-xs font-extrabold uppercase text-primary">Справочник</p>
                <h2 className="text-2xl font-bold">Каталог предметов</h2>
                <p className="text-muted-foreground">Внутриигровые снасти с полными характеристиками.</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    {itemTypes.map((value) => (
                        <button key={value} type="button" onClick={() => changeType(value)} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${type === value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
                            {typeLabels[value]}
                        </button>
                    ))}
                </div>
                <div className="inline-flex rounded-lg border border-border p-1" aria-label="Вид каталога">
                    <button type="button" onClick={() => setView("cards")} title="Карточками" className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${view === "cards" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><LayoutGrid size={15} /> Карточки</button>
                    <button type="button" onClick={() => setView("rows")} title="Строками" className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${view === "rows" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Rows3 size={15} /> Строки</button>
                </div>
            </div>

            <form onSubmit={applySearch} className="grid gap-3 border-y border-border py-4 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto_auto] lg:items-end">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Поиск по всем характеристикам</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Название, бренд, тест, механизм…" /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Категория</span><select value={category} onChange={(event) => { setOffset(0); setCategory(event.target.value); }}><option value="">Все категории</option>{itemCategories[type].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                {view === "cards" ? (
                    <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Сортировка</span><select value={`${sortBy}:${sortDirection}`} onChange={(event) => { const [field, direction] = event.target.value.split(":"); setSortBy(field); setSortDirection(direction as SortDirection); setOffset(0); }}><option value="name:asc">Название А→Я</option><option value="name:desc">Название Я→А</option><option value="brend:asc">Бренд А→Я</option><option value="lvl:asc">Уровень ↑</option><option value="lvl:desc">Уровень ↓</option></select></label>
                ) : <div className="hidden lg:block" />}
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Search size={16} /> Найти</button>
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
