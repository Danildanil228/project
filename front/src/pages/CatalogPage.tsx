import { useEffect, useState, type FormEvent } from "react";
import { ItemCard } from "../components/ItemCard";
import { fetchItems, itemCategories, typeLabels, type CatalogItem, type ItemType } from "../lib/items-api";

const pageSize = 24;
const itemTypes: ItemType[] = ["reels", "rods"];

export function CatalogPage() {
    const [type, setType] = useState<ItemType>("reels");
    const [searchInput, setSearchInput] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [category, setCategory] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "lvl">("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [offset, setOffset] = useState(0);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        setError("");
        fetchItems(type, { search: appliedSearch, category, sortBy, sortDirection, limit: pageSize, offset })
            .then((response) => {
                if (ignore) return;
                setItems(response.items as CatalogItem[]);
                setTotal(response.total);
            })
            .catch((caught) => {
                if (!ignore) setError(caught instanceof Error ? caught.message : "Ошибка загрузки");
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => {
            ignore = true;
        };
    }, [type, appliedSearch, category, sortBy, sortDirection, offset]);

    function changeType(next: ItemType) {
        if (next === type) return;
        setType(next);
        setCategory("");
        setSearchInput("");
        setAppliedSearch("");
        setOffset(0);
    }

    function applySearch(event: FormEvent) {
        event.preventDefault();
        setOffset(0);
        setAppliedSearch(searchInput.trim());
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + pageSize, total);

    return (
        <section className="grid gap-5">
            <div className="grid gap-1">
                <p className="text-xs font-extrabold uppercase text-primary">Справочник</p>
                <h2 className="text-2xl font-bold">Каталог предметов</h2>
                <p className="text-muted-foreground">Внутриигровые снасти с характеристиками. Доступно без входа.</p>
            </div>

            <div className="flex gap-2">
                {itemTypes.map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => changeType(value)}
                        className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                            type === value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
                        }`}
                    >
                        {typeLabels[value]}
                    </button>
                ))}
            </div>

            <form onSubmit={applySearch} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Поиск по названию</span>
                    <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Например, Raptor" />
                </label>
                <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Категория</span>
                    <select
                        value={category}
                        onChange={(event) => {
                            setOffset(0);
                            setCategory(event.target.value);
                        }}
                    >
                        <option value="">Все</option>
                        {itemCategories[type].map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Сортировка</span>
                    <select
                        value={`${sortBy}:${sortDirection}`}
                        onChange={(event) => {
                            const [nextSortBy, nextDirection] = event.target.value.split(":");
                            setOffset(0);
                            setSortBy(nextSortBy as "name" | "lvl");
                            setSortDirection(nextDirection as "asc" | "desc");
                        }}
                    >
                        <option value="name:asc">Название А→Я</option>
                        <option value="name:desc">Название Я→А</option>
                        <option value="lvl:asc">Уровень ↑</option>
                        <option value="lvl:desc">Уровень ↓</option>
                    </select>
                </label>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                    Найти
                </button>
            </form>

            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {loading ? (
                <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
            ) : items.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">Ничего не найдено</p>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((item) => (
                        <ItemCard key={item.id} type={type} item={item} />
                    ))}
                </div>
            )}

            {total > pageSize && (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                        {from}–{to} из {total}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - pageSize))}
                            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
                        >
                            Назад
                        </button>
                        <button
                            type="button"
                            disabled={to >= total}
                            onClick={() => setOffset(offset + pageSize)}
                            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
                        >
                            Вперёд
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
