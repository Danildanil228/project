import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { SelectMenu } from "../components/SelectMenu";
import { TableRowsSkeleton } from "../components/LoadingState";
import { ItemForm } from "../features/items/ItemForm";
import { fetchItems, itemCategories, typeLabels, type ItemType } from "../lib/items-api";
import { createItemRequest, deleteItemRequest, updateItemRequest } from "../lib/items-admin-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { canManageCatalog, getErrorMessage } from "../utils/admin-format";

type ItemAdminPageProps = { currentUser?: ManagedUser; adminContext?: AdminSecurityContext | null; onOpenAuthModal: () => void };
type ItemRow = { id: number; name: string; category: string; brend: string; type?: string; lvl: number | null } & Record<string, unknown>;

const itemTypes: ItemType[] = ["reels", "rods"];
const pageSize = 50;

export function ItemAdminPage({ currentUser, adminContext, onOpenAuthModal }: ItemAdminPageProps) {
    const canManage = canManageCatalog(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [type, setType] = useState<ItemType>("reels");
    const [rows, setRows] = useState<ItemRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [brand, setBrand] = useState("");
    const [rodType, setRodType] = useState("");
    const [minLvl, setMinLvl] = useState("");
    const [maxLvl, setMaxLvl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<ItemRow | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [resetVersion, setResetVersion] = useState(0);

    async function loadRows(nextType = type, nextOffset = offset) {
        setLoading(true);
        setError("");
        try {
            const response = await fetchItems(nextType, {
                search, category, brend: brand, type: nextType === "rods" ? rodType : "",
                minLvl: minLvl ? Number(minLvl) : undefined, maxLvl: maxLvl ? Number(maxLvl) : undefined,
                limit: pageSize, offset: nextOffset, sortBy: "name", sortDirection: "asc",
            });
            setRows(response.items as ItemRow[]);
            setTotal(response.total);
            setOffset(nextOffset);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { if (canManage) void loadRows(type, 0); }, [type, canManage, resetVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- filters are applied by the form

    function changeType(next: ItemType) {
        if (next === type) return;
        setType(next); setCategory(""); setBrand(""); setRodType(""); setSearch(""); setMinLvl(""); setMaxLvl("");
        setFormOpen(false); setEditing(null); setNotice(""); setOffset(0);
    }

    function resetFilters() {
        setSearch(""); setCategory(""); setBrand(""); setRodType(""); setMinLvl(""); setMaxLvl("");
        setResetVersion((value) => value + 1);
    }

    function startCreate() { setEditing(null); setFormError(""); setFormOpen(true); }
    function startEdit(row: ItemRow) { setEditing(row); setFormError(""); setFormOpen(true); }

    async function submitForm(data: Record<string, unknown>) {
        setSubmitting(true); setFormError(""); setNotice("");
        try {
            if (editing) { await updateItemRequest(type, editing.id, data); setNotice("Предмет обновлён"); }
            else { await createItemRequest(type, data); setNotice("Предмет создан"); }
            setFormOpen(false); setEditing(null); await loadRows(type, offset);
        } catch (caught) { setFormError(getErrorMessage(caught)); }
        finally { setSubmitting(false); }
    }

    async function removeRow(row: ItemRow) {
        if (!await confirm({ title: "Удалить предмет", message: `Удалить «${row.name}»? Действие необратимо.`, confirmText: "Удалить", tone: "danger" })) return;
        setNotice(""); setError("");
        try { await deleteItemRequest(type, row.id); setNotice("Предмет удалён"); await loadRows(type, rows.length === 1 && offset ? Math.max(0, offset - pageSize) : offset); }
        catch (caught) { setError(getErrorMessage(caught)); }
    }

    if (!canManage) return <section className="grid gap-4"><div className="rounded-lg border border-border bg-card p-6 text-center"><h2 className="text-xl font-bold">Доступ ограничен</h2><p className="mt-1 text-muted-foreground">Управление снастями доступно только администраторам.</p>{!currentUser && <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</button>}</div></section>;

    const page = Math.floor(offset / pageSize) + 1;
    const pages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div className="grid gap-1"><p className="text-xs font-extrabold uppercase text-primary">Администрирование</p><h2 className="text-2xl font-bold">Управление снастями</h2><p className="text-muted-foreground">{total.toLocaleString("ru-RU")} предметов</p></div><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus size={16} /> Добавить</button></div>

            <div className="flex gap-2">{itemTypes.map((value) => <button key={value} type="button" onClick={() => changeType(value)} className={`rounded-lg px-4 py-2 text-sm font-bold ${type === value ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-muted"}`}>{typeLabels[value]}</button>)}</div>

            <form onSubmit={(event: FormEvent) => { event.preventDefault(); void loadRows(type, 0); }} className="grid gap-3 border-y border-border py-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_170px_170px_110px_110px_auto_auto] xl:items-end">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Поиск по всем полям</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название, бренд, характеристика…" /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Категория</span><SelectMenu value={category} onChange={setCategory} options={[{ value: "", label: "Все" }, ...itemCategories[type].map((value) => ({ value, label: value }))]} /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Бренд</span><input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Например, Reef" /></label>
                {type === "rods" ? <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Тип удилища</span><input value={rodType} onChange={(event) => setRodType(event.target.value)} /></label> : <div className="hidden xl:block" />}
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Ур. от</span><input type="number" min="0" value={minLvl} onChange={(event) => setMinLvl(event.target.value)} /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Ур. до</span><input type="number" min="0" value={maxLvl} onChange={(event) => setMaxLvl(event.target.value)} /></label>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Search size={16} /> Найти</button>
                <button type="button" onClick={resetFilters} title="Сбросить фильтры" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold"><X size={16} /> Сбросить</button>
            </form>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            {formOpen && <ItemForm key={editing ? `edit-${editing.id}` : `create-${type}`} type={type} initial={editing} submitting={submitting} error={formError} onSubmit={submitForm} onCancel={() => { setFormOpen(false); setEditing(null); }} />}

            <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="p-3">Название</th><th className="p-3">Категория</th><th className="p-3">Бренд</th>{type === "rods" && <th className="p-3">Тип</th>}<th className="p-3">Ур.</th><th className="p-3 text-right">Действия</th></tr></thead><tbody>
                {loading ? <TableRowsSkeleton columns={type === "rods" ? 6 : 5} rows={8} /> : rows.length === 0 ? <tr><td colSpan={type === "rods" ? 6 : 5} className="p-6 text-center text-muted-foreground">Ничего не найдено</td></tr> : rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-3 font-medium">{row.name}</td><td className="p-3 text-muted-foreground">{row.category}</td><td className="p-3 text-muted-foreground">{row.brend}</td>{type === "rods" && <td className="p-3 text-muted-foreground">{row.type || "—"}</td>}<td className="p-3 text-muted-foreground">{row.lvl ?? "—"}</td><td className="p-3"><div className="flex justify-end gap-2"><button type="button" title="Изменить" onClick={() => startEdit(row)} className="grid size-9 place-items-center rounded-lg border border-border hover:border-primary"><Pencil size={15} /></button><button type="button" title="Удалить" onClick={() => removeRow(row)} className="grid size-9 place-items-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 size={15} /></button></div></td></tr>)}
            </tbody></table></div>

            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Страница {page} из {pages}</span><div className="flex gap-2"><button type="button" title="Предыдущая страница" disabled={!offset || loading} onClick={() => void loadRows(type, Math.max(0, offset - pageSize))} className="grid size-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" title="Следующая страница" disabled={offset + pageSize >= total || loading} onClick={() => void loadRows(type, offset + pageSize)} className="grid size-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
            {dialog}
        </section>
    );
}
