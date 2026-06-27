import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { PageHeader } from "../components/PageHeader";
import { SelectMenu } from "../components/SelectMenu";
import { CatalogViewToggle, useCatalogView } from "../components/CatalogViewToggle";
import { listFish, listWaterbodies } from "../lib/reference-api";
import { mediaUrl } from "../lib/items-api";
import { fishRarities, type Fish, type FishRarity } from "../types/fish";
import type { WaterbodyListRow } from "../types/waterbody";
import { getErrorMessage } from "../utils/admin-format";

function formatWeight(grams: number | null) {
    if (grams === null) return "—";
    if (grams < 1000) return `${grams.toLocaleString("ru-RU")} г`;
    return `${(grams / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} кг`;
}

export function FishCatalogPage() {
    const [rows, setRows] = useState<Fish[]>([]);
    const [waterbodies, setWaterbodies] = useState<WaterbodyListRow[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search.trim(), 300);
    const [rarity, setRarity] = useState<FishRarity | "">("");
    const [waterbodyId, setWaterbodyId] = useState("");
    const [view, setView] = useCatalogView();
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function load() {
        setLoading(true);
        setError("");
        try {
            const [fishResponse, waterbodyResponse] = await Promise.all([
                listFish({
                    search: debouncedSearch,
                    rarity: rarity || undefined,
                    waterbodyId: waterbodyId ? Number(waterbodyId) : undefined,
                    limit: 500,
                }),
                listWaterbodies({ limit: 500 }),
            ]);
            setRows(fishResponse.items);
            setTotal(fishResponse.total);
            setWaterbodies(waterbodyResponse.items);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, rarity, waterbodyId]);

    function reset() {
        setSearch("");
        setRarity("");
        setWaterbodyId("");
    }

    const hasFilters = Boolean(debouncedSearch || rarity || waterbodyId);

    return (
        <section className="grid gap-5">
            <PageHeader eyebrow="Каталог" title="Рыба" description="Публичный справочник рыб с фото, трофейными весами и водоемами." />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link to="/catalog" className="w-fit text-sm font-bold text-primary hover:underline">← К каталогу</Link>
                <CatalogViewToggle value={view} onChange={setView} />
            </div>

            <div className="grid gap-3 border-y border-border py-4 md:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_190px_240px_auto] lg:items-end">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Поиск</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название рыбы" /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Редкость</span><SelectMenu value={rarity} onChange={(value) => setRarity(value as FishRarity | "")} options={[{ value: "", label: "Все" }, ...fishRarities.map((value) => ({ value, label: value }))]} /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Водоем</span><SelectMenu value={waterbodyId} onChange={setWaterbodyId} options={[{ value: "", label: "Все водоемы" }, ...waterbodies.map((waterbody) => ({ value: String(waterbody.id), label: waterbody.name }))]} /></label>
                <button type="button" onClick={reset} disabled={!hasFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-40"><X size={16} /> Сбросить</button>
            </div>

            <p className="text-sm text-muted-foreground">Найдено: {total.toLocaleString("ru-RU")}</p>
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            {loading ? <p className="py-10 text-center text-muted-foreground">Загрузка…</p> : rows.length === 0 ? <p className="py-10 text-center text-muted-foreground">Ничего не найдено</p> : view === "cards" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {rows.map((fish) => (
                        <article key={fish.id} className="grid gap-2 rounded-lg border border-border bg-card p-3">
                            {fish.photo ? <img src={mediaUrl(fish.photo)} alt={fish.name} title={fish.name} className="aspect-[4/3] w-full rounded bg-muted object-contain" /> : <div className="grid aspect-[4/3] place-items-center rounded bg-muted text-xs text-muted-foreground">Нет фото</div>}
                            <div className="grid gap-1">
                                <h3 className="line-clamp-2 text-sm">{fish.name}</h3>
                                <p className="text-xs text-muted-foreground">{fish.rarity}</p>
                                <p className="text-xs text-muted-foreground">Трофей: {formatWeight(fish.trophyWeightGrams)}</p>
                                <p className="text-xs text-muted-foreground">Редкий: {formatWeight(fish.rareTrophyWeightGrams)}</p>
                                <p className="line-clamp-2 text-xs text-muted-foreground">{fish.waterbodies.map((item) => item.name).join(", ") || "Водоемы не указаны"}</p>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-muted-foreground">
                                <th className="p-3">Фото</th>
                                <th className="p-3">Название</th>
                                <th className="p-3">Редкость</th>
                                <th className="p-3">Трофей</th>
                                <th className="p-3">Редкий трофей</th>
                                <th className="p-3">Водоемы</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((fish) => (
                                <tr key={fish.id} className="border-t border-border">
                                    <td className="p-3">{fish.photo ? <img src={mediaUrl(fish.photo)} alt={fish.name} title={fish.name} className="h-12 w-16 rounded border border-border object-contain" /> : <span className="text-muted-foreground">—</span>}</td>
                                    <td className="p-3 font-medium">{fish.name}</td>
                                    <td className="p-3 text-muted-foreground">{fish.rarity}</td>
                                    <td className="whitespace-nowrap p-3 text-muted-foreground">{formatWeight(fish.trophyWeightGrams)}</td>
                                    <td className="whitespace-nowrap p-3 text-muted-foreground">{formatWeight(fish.rareTrophyWeightGrams)}</td>
                                    <td className="max-w-sm p-3 text-muted-foreground">{fish.waterbodies.map((item) => item.name).join(", ") || "Водоемы не указаны"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
