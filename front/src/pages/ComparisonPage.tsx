import { useQueries } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { LoadingImage } from "../components/LoadingImage";
import { PageHeader } from "../components/PageHeader";
import { useComparison } from "../context/ComparisonContext";
import { itemFields, type ItemFieldDef } from "../lib/item-fields";
import { fetchItem, fetchItems, mediaUrl, type CatalogItem, type ItemType } from "../lib/items-api";
import type { Reel } from "../types/reel";
import type { Rod } from "../types/rod";

type ComparisonItem = Reel | Rod;
type Direction = "higher" | "lower" | "true";
type ItemColumn = { kind: "item"; id: number; item?: ComparisonItem; loading: boolean; error: boolean };
type AddColumn = { kind: "add" };
type EmptyColumn = { kind: "empty"; key: number };
type ComparisonColumn = ItemColumn | AddColumn | EmptyColumn;

const preferredDirection: Record<ItemType, Record<string, Direction>> = {
    reels: {
        test: "higher",
        test_mod: "higher",
        protection: "true",
        speed: "higher",
        speed_mod: "higher",
        frik: "higher",
        frik_mod: "higher",
        meh: "higher",
        meh_mod: "higher",
        capacity: "higher",
        capacity_mod: "higher",
        lvl: "lower",
        price_ser: "lower",
        price_gold: "lower",
    },
    rods: {
        test_down: "lower",
        test_up: "higher",
        sensi: "higher",
        stren: "higher",
        bonus_opit: "higher",
        bonus_snast: "higher",
        bonus_nav: "higher",
        bonus_zabros: "higher",
        lvl: "lower",
        price_ser: "lower",
        price_gold: "lower",
    },
};

function rawValue(item: ComparisonItem, key: string) {
    return (item as unknown as Record<string, unknown>)[key];
}

function formatValue(value: unknown) {
    if (typeof value === "boolean") return value ? "Да" : "Нет";
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
}

function normalizedValue(value: unknown) {
    return formatValue(value).trim().toLocaleLowerCase("ru-RU");
}

function numericValue(value: unknown) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const match = value.replace(/\u00a0/g, " ").match(/-?\d[\d ]*(?:[.,]\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0].replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function bestItemIds(type: ItemType, field: ItemFieldDef, items: ComparisonItem[], different: boolean) {
    const direction = preferredDirection[type][field.key];
    if (!direction || !different) return new Set<number>();
    if (direction === "true") {
        return new Set(items.filter((item) => rawValue(item, field.key) === true).map((item) => item.id));
    }
    const candidates = items
        .map((item) => ({ id: item.id, value: numericValue(rawValue(item, field.key)) }))
        .filter((entry): entry is { id: number; value: number } => entry.value !== null);
    if (candidates.length < 2 || new Set(candidates.map((entry) => entry.value)).size < 2) return new Set<number>();
    const target = direction === "higher"
        ? Math.max(...candidates.map((entry) => entry.value))
        : Math.min(...candidates.map((entry) => entry.value));
    return new Set(candidates.filter((entry) => entry.value === target).map((entry) => entry.id));
}

function ComparisonItemCard({ column, type, onRemove }: { column: ItemColumn; type: ItemType; onRemove: (id: number) => void }) {
    if (column.loading) return <div className="flex min-h-40 items-center justify-center border-l border-border bg-card"><LoaderCircle className="animate-spin text-primary" size={24} /></div>;
    if (!column.item || column.error) return <div className="relative flex min-h-40 items-center justify-center border-l border-border bg-card p-4 text-center text-sm text-destructive"><button type="button" onClick={() => onRemove(column.id)} title="Убрать" className="absolute right-2 top-2 grid size-8 place-items-center rounded hover:bg-muted"><X size={16} /></button>Предмет больше недоступен</div>;
    const item = column.item;
    return (
        <div className="relative flex min-h-40 flex-col border-l border-border bg-card p-3">
            <button type="button" onClick={() => onRemove(item.id)} title="Убрать из сравнения" className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-md bg-card/90 text-muted-foreground shadow-sm hover:bg-destructive/10 hover:text-destructive"><X size={16} /></button>
            <Link to={`/catalog/${type}/${item.id}`} className="grid flex-1 gap-2 text-foreground no-underline hover:text-primary">
                {item.photo
                    ? <LoadingImage src={mediaUrl(item.photo)} alt={item.name} title={item.name} className="h-24 w-full" imageClassName="object-contain" />
                    : <div className="grid h-24 place-items-center rounded bg-muted text-2xl font-bold text-muted-foreground">{item.name.slice(0, 2)}</div>}
                <strong className="line-clamp-2 text-sm leading-tight">{item.name}</strong>
            </Link>
        </div>
    );
}

function AddItemDialog({ type, selectedIds, onAdded, onClose }: { type: ItemType | null; selectedIds: number[]; onAdded: (nextCount: number) => void; onClose: () => void }) {
    const comparison = useComparison();
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search.trim(), 250);
    const pickerTypes: ItemType[] = type ? [type] : ["reels", "rods"];
    const pickerQueries = useQueries({
        queries: pickerTypes.map((itemType) => ({
            queryKey: ["comparison-picker", itemType, debouncedSearch],
            queryFn: () => fetchItems(itemType, { search: debouncedSearch, sortBy: "name", sortDirection: "asc", limit: type ? 30 : 15, offset: 0 }),
        })),
    });
    const items = pickerQueries.flatMap((query, index) => ((query.data?.items ?? []) as CatalogItem[])
        .filter((item) => !selectedIds.includes(item.id))
        .map((item) => ({ ...item, itemType: pickerTypes[index] })));
    const isFetching = pickerQueries.some((query) => query.isFetching);
    const hasData = pickerQueries.some((query) => Boolean(query.data));
    const failed = pickerQueries.length > 0 && pickerQueries.every((query) => Boolean(query.error));

    useEffect(() => {
        function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="comparison-picker-title" className="flex max-h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div><h2 id="comparison-picker-title" className="text-lg">{type ? `Добавить ${type === "reels" ? "катушку" : "удилище"}` : "Добавить снасть"}</h2><p className="text-sm text-muted-foreground">Можно выбрать ещё {comparison.maxItems - comparison.ids.length}</p></div>
                    <button type="button" onClick={onClose} title="Закрыть" className="grid size-9 place-items-center rounded-lg border border-border hover:border-primary"><X size={17} /></button>
                </header>
                <div className="relative border-b border-border p-4">
                    <Search size={17} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по названию и характеристикам" className="pl-10" />
                </div>
                <div className="subtle-scrollbar grid min-h-40 flex-1 gap-1 overflow-y-auto p-2">
                    {isFetching && !hasData ? <div className="grid min-h-40 place-items-center"><LoaderCircle className="animate-spin text-primary" size={24} /></div>
                        : failed ? <p className="p-4 text-center text-sm text-destructive">Не удалось загрузить каталог</p>
                            : items.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Подходящих предметов не найдено</p>
                                : items.map((item) => <button key={`${item.itemType}-${item.id}`} type="button" onClick={() => { if (comparison.add(item.itemType, item.id, item.name)) { onAdded(comparison.ids.length + 1); onClose(); } }} className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-muted">
                                    {item.photo ? <LoadingImage src={mediaUrl(item.photo)} alt={item.name} className="h-14 w-20 shrink-0" imageClassName="object-contain" /> : <div className="grid h-14 w-20 shrink-0 place-items-center rounded bg-muted font-bold">{item.name.slice(0, 2)}</div>}
                                    <span className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><span className="block truncate text-xs text-muted-foreground">{item.itemType === "reels" ? "Катушка" : "Удилище"} · {item.category} · {item.brend}</span></span>
                                    <Plus size={17} className="ml-auto shrink-0 text-primary" />
                                </button>)}
                </div>
            </section>
        </div>
    );
}

function useVisibleColumnCount() {
    const [count, setCount] = useState(() => window.innerWidth < 640 ? 2 : window.innerWidth < 1200 ? 3 : 4);

    useEffect(() => {
        function update() { setCount(window.innerWidth < 640 ? 2 : window.innerWidth < 1200 ? 3 : 4); }
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return count;
}

export function ComparisonPage() {
    const comparison = useComparison();
    const { confirm, dialog } = useConfirmDialog();
    const [differentOnly, setDifferentOnly] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [startIndex, setStartIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState<"next" | "previous" | null>(null);
    const visibleCount = useVisibleColumnCount();
    const activeType = comparison.type ?? "reels";

    const queries = useQueries({
        queries: comparison.ids.map((id) => ({
            queryKey: ["comparison-item", activeType, id],
            queryFn: async () => (await fetchItem(activeType, id)).item as ComparisonItem,
            staleTime: 60_000,
        })),
    });

    const itemColumns: ItemColumn[] = comparison.ids.map((id, index) => ({
        kind: "item",
        id,
        item: queries[index]?.data,
        loading: queries[index]?.isPending ?? true,
        error: Boolean(queries[index]?.error),
    }));
    const loadedItems = itemColumns.flatMap((column) => column.item ? [column.item] : []);
    const canAdd = comparison.ids.length < comparison.maxItems;
    const allColumns: ComparisonColumn[] = [...itemColumns, ...(canAdd ? [{ kind: "add" } as AddColumn] : [])];
    const maxStartIndex = Math.max(0, allColumns.length - visibleCount);
    const visibleColumns = allColumns.slice(startIndex, startIndex + visibleCount);
    while (visibleColumns.length < visibleCount) visibleColumns.push({ kind: "empty", key: startIndex + visibleColumns.length });
    const labelWidth = visibleCount === 2 ? 104 : 140;
    const outerGridTemplate = `${labelWidth}px minmax(0, 1fr)`;
    const itemGridTemplate = `repeat(${visibleCount}, minmax(0, 1fr))`;
    const headerGridTemplate = `${labelWidth}px repeat(${visibleCount}, minmax(0, 1fr))`;
    const animationClass = slideDirection === "next" ? "comparison-slide-next" : slideDirection === "previous" ? "comparison-slide-previous" : "";

    const rows = itemFields[activeType]
        .filter((field) => field.kind !== "file")
        .map((field) => {
            const values = loadedItems.map((item) => rawValue(item, field.key));
            const different = new Set(values.map(normalizedValue)).size > 1;
            return { field, different, bestIds: bestItemIds(activeType, field, loadedItems, different) };
        })
        .filter((row) => !differentOnly || row.different);

    function move(direction: -1 | 1) {
        setSlideDirection(direction === 1 ? "next" : "previous");
        setStartIndex((current) => Math.max(0, Math.min(maxStartIndex, current + direction)));
    }

    async function clearAll() {
        if (!comparison.ids.length) return;
        const accepted = await confirm({ title: "Очистить сравнение", message: "Удалить все предметы из сравнения?", confirmText: "Очистить", tone: "danger" });
        if (accepted) comparison.clear();
    }

    useEffect(() => { setStartIndex((current) => Math.min(current, maxStartIndex)); }, [maxStartIndex]);

    return (
        <section className="grid min-w-0 max-w-full gap-5">
            <PageHeader eyebrow="Каталог" title="Сравнение снастей" description="Сопоставьте характеристики до 10 катушек или удилищ." />

            {comparison.ids.length > 0 && <div className="flex flex-wrap items-center justify-end gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                        <input type="checkbox" checked={differentOnly} disabled={loadedItems.length < 2} onChange={(event) => setDifferentOnly(event.target.checked)} className="size-4 accent-[var(--primary)]" />
                        Только различия
                    </label>
                    <button type="button" onClick={clearAll} className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-bold text-destructive"><Trash2 size={15} /> Очистить</button>
            </div>}

            <div className="grid min-w-0 gap-0">
                <div className="sticky top-14 z-20 min-w-0 max-w-full bg-background pb-0 pt-2">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Добавлено: <strong className="text-foreground">{comparison.ids.length}</strong> из {comparison.maxItems}</span>
                        <div className="flex gap-1">
                            <button type="button" onClick={() => move(-1)} disabled={startIndex === 0} title="Показать предыдущие" className="grid size-9 place-items-center rounded-lg border border-border bg-card disabled:opacity-35"><ChevronLeft size={18} /></button>
                            <button type="button" onClick={() => move(1)} disabled={startIndex >= maxStartIndex} title="Показать следующие" className="grid size-9 place-items-center rounded-lg border border-border bg-card disabled:opacity-35"><ChevronRight size={18} /></button>
                        </div>
                    </div>
                    <div key={`header-${startIndex}-${visibleCount}`} className={`grid w-full min-w-0 overflow-hidden border border-border bg-card ${comparison.ids.length ? "rounded-t-lg" : "rounded-lg"} ${animationClass}`} style={{ gridTemplateColumns: headerGridTemplate }}>
                        <div aria-hidden="true" className="min-h-40 bg-card" />
                        {visibleColumns.map((column, index) => column.kind === "item"
                            ? <div key={column.id} className="min-w-0"><ComparisonItemCard column={column} type={activeType} onRemove={comparison.remove} /></div>
                            : column.kind === "add" ? <button key="add" type="button" onClick={() => setPickerOpen(true)} className="grid min-h-40 place-items-center gap-2 border-l border-border bg-card p-4 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-primary"><span className="grid size-11 place-items-center rounded-full border border-dashed border-current"><Plus size={22} /></span><span>Добавить предмет</span></button>
                                : <div key={`empty-${column.key}-${index}`} className="min-h-40 border-l border-border bg-card" />)}
                    </div>
                </div>

                {loadedItems.length > 1 && differentOnly && rows.length === 0 && <p className="border-x border-b border-border bg-card p-6 text-center text-muted-foreground">У выбранных предметов нет различающихся характеристик</p>}

                {comparison.ids.length > 0 && rows.length > 0 && <div className="w-full min-w-0 max-w-full overflow-hidden rounded-b-lg border-x border-b border-border bg-card">
                    {rows.map(({ field, different, bestIds }) => <div key={field.key} className="grid border-b border-border last:border-b-0" style={{ gridTemplateColumns: outerGridTemplate }}>
                        <div className={`flex min-h-14 items-center border-r border-border px-3 py-2 text-sm font-bold ${different ? "bg-amber-500/10" : "bg-muted/45"}`}>{field.label}</div>
                        <div key={`${field.key}-${startIndex}-${visibleCount}`} className={`grid min-w-0 ${animationClass}`} style={{ gridTemplateColumns: itemGridTemplate }}>
                            {visibleColumns.map((column, index) => {
                                if (column.kind !== "item") return <div key={`${field.key}-blank-${index}`} className={`min-h-14 border-r border-border px-3 py-2 ${different ? "bg-amber-500/5" : ""}`} />;
                                const value = column.item ? rawValue(column.item, field.key) : null;
                                const best = column.item ? bestIds.has(column.item.id) : false;
                                return <div key={`${field.key}-${column.id}`} title={best ? "Лучшее значение среди выбранных" : undefined} className={`flex min-h-14 min-w-0 items-center overflow-hidden break-words border-r border-border px-2 py-2 text-xs last:border-r-0 sm:px-3 sm:text-sm ${best ? "bg-green-500/15 font-bold text-green-800 dark:text-green-300" : different ? "bg-amber-500/5" : ""}`}>{column.loading ? <LoaderCircle size={15} className="animate-spin" /> : formatValue(value)}</div>;
                            })}
                        </div>
                    </div>)}
                </div>}
            </div>

            {pickerOpen && <AddItemDialog type={comparison.type} selectedIds={comparison.ids} onAdded={(nextCount) => { const nextColumnCount = nextCount < comparison.maxItems ? nextCount + 1 : nextCount; setStartIndex(Math.max(0, nextColumnCount - visibleCount)); setSlideDirection("next"); }} onClose={() => setPickerOpen(false)} />}
            {dialog}
        </section>
    );
}
