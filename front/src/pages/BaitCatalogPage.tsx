import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { PageHeader } from "../components/PageHeader";
import { SelectMenu } from "../components/SelectMenu";
import { CatalogViewToggle, useCatalogView } from "../components/CatalogViewToggle";
import { LoadingImage } from "../components/LoadingImage";
import { CardGridSkeleton, TableSkeleton } from "../components/LoadingState";
import { getBaitCatalogMeta, listBaits } from "../lib/reference-api";
import { mediaUrl } from "../lib/items-api";
import { baitDomainLabels, type Bait, type BaitCatalogMeta, type BaitDomain } from "../types/bait";
import { getErrorMessage } from "../utils/admin-format";

const pageSize = 80;
const emptyMeta: BaitCatalogMeta = { categories: [] };

export function BaitCatalogPage() {
    const [rows, setRows] = useState<Bait[]>([]);
    const [meta, setMeta] = useState<BaitCatalogMeta>(emptyMeta);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search.trim(), 300);
    const [domain, setDomain] = useState<BaitDomain | "">("");
    const [categoryCode, setCategoryCode] = useState("");
    const [view, setView] = useCatalogView();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const categories = useMemo(() => meta.categories.filter((item) => !domain || item.domain === domain), [domain, meta.categories]);

    async function load(nextOffset = offset) {
        setLoading(true);
        setError("");
        try {
            const response = await listBaits({ search: debouncedSearch, domain, categoryCode, limit: pageSize, offset: nextOffset });
            setRows(response.items);
            setTotal(response.total);
            setOffset(nextOffset);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        getBaitCatalogMeta().then(setMeta).catch(() => undefined);
    }, []);

    useEffect(() => {
        void load(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, domain, categoryCode]);

    function reset() {
        setSearch("");
        setDomain("");
        setCategoryCode("");
        setOffset(0);
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + pageSize, total);
    const hasFilters = Boolean(debouncedSearch || domain || categoryCode);

    return (
        <section className="grid gap-5">
            <PageHeader eyebrow="Каталог" title="Приманки и наживки" description="Публичный справочник с фото, разделами и категориями." />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link to="/catalog" className="w-fit text-sm font-bold text-primary hover:underline">← К каталогу</Link>
                <CatalogViewToggle value={view} onChange={setView} />
            </div>

            <div className="grid gap-3 border-y border-border py-4 lg:grid-cols-[minmax(260px,1fr)_190px_240px_auto] lg:items-end">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Поиск</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название приманки или наживки" /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Раздел</span><SelectMenu value={domain} onChange={(value) => { setDomain(value as BaitDomain | ""); setCategoryCode(""); }} options={[{ value: "", label: "Все" }, { value: "bait", label: "Наживки" }, { value: "lure", label: "Приманки" }]} /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Категория</span><SelectMenu value={categoryCode} onChange={setCategoryCode} options={[{ value: "", label: "Все категории" }, ...categories.map((item) => ({ value: item.code, label: item.name }))]} /></label>
                <button type="button" onClick={reset} disabled={!hasFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-40"><X size={16} /> Сбросить</button>
            </div>

            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            {loading ? (view === "cards" ? <CardGridSkeleton count={10} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" /> : <TableSkeleton columns={4} rows={8} />) : rows.length === 0 ? <p className="py-10 text-center text-muted-foreground">Ничего не найдено</p> : view === "cards" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {rows.map((item) => (
                        <article key={item.id} className="grid gap-2 rounded-lg border border-border bg-card p-3">
                            {item.photo ? <LoadingImage src={mediaUrl(item.photo)} alt={item.name} title={item.name} className="aspect-square w-full rounded bg-muted" imageClassName="object-contain" /> : <div className="grid aspect-square place-items-center rounded bg-muted text-xs text-muted-foreground">Нет фото</div>}
                            <div>
                                <h3 className="line-clamp-2 text-sm">{item.name}</h3>
                                <p className="text-xs text-muted-foreground">{baitDomainLabels[item.domain]} · {item.categoryName ?? "Без категории"}</p>
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
                                <th className="p-3">Раздел</th>
                                <th className="p-3">Категория</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((item) => (
                                <tr key={item.id} className="border-t border-border">
                                    <td className="p-3">{item.photo ? <LoadingImage src={mediaUrl(item.photo)} alt={item.name} title={item.name} className="h-14 w-14 rounded border border-border" imageClassName="object-contain" /> : <span className="text-muted-foreground">—</span>}</td>
                                    <td className="p-3 font-medium">{item.name}</td>
                                    <td className="p-3">{baitDomainLabels[item.domain]}</td>
                                    <td className="p-3">{item.categoryName ?? "Без категории"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {total > pageSize && (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">{from}–{to} из {total}</span>
                    <div className="flex gap-2">
                        <button type="button" title="Предыдущая страница" disabled={offset === 0 || loading} onClick={() => void load(Math.max(0, offset - pageSize))} className="grid size-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={16} /></button>
                        <button type="button" title="Следующая страница" disabled={to >= total || loading} onClick={() => void load(offset + pageSize)} className="grid size-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}
        </section>
    );
}
