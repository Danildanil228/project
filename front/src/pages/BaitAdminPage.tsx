import { ChevronLeft, ChevronRight, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { PhotoUploadField } from "../components/PhotoUploadField";
import { mediaUrl } from "../lib/items-api";
import { createBait, deleteBait, getBaitCatalogMeta, listBaits, updateBait } from "../lib/reference-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { baitDomainLabels, type Bait, type BaitCatalogMeta, type BaitDomain } from "../types/bait";
import { canManageCatalog, getErrorMessage } from "../utils/admin-format";

type Props = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

type FormState = {
    name: string;
    domain: BaitDomain;
    categoryCode: string;
    photo: string;
    isActive: boolean;
};

const pageSize = 100;
const emptyMeta: BaitCatalogMeta = { categories: [] };
const emptyForm: FormState = { name: "", domain: "bait", categoryCode: "", photo: "", isActive: true };

export function BaitAdminPage({ currentUser, adminContext, onOpenAuthModal }: Props) {
    const canManage = canManageCatalog(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [rows, setRows] = useState<Bait[]>([]);
    const [meta, setMeta] = useState<BaitCatalogMeta>(emptyMeta);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [domain, setDomain] = useState<BaitDomain | "">("");
    const [categoryCode, setCategoryCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [editing, setEditing] = useState<Bait | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const filterCategories = useMemo(() => meta.categories.filter((item) => !domain || item.domain === domain), [domain, meta.categories]);
    const formCategories = useMemo(() => meta.categories.filter((item) => item.domain === form.domain), [form.domain, meta.categories]);

    async function load(nextOffset = offset) {
        setLoading(true);
        setError("");
        try {
            const response = await listBaits({ search, domain, categoryCode, includeInactive: true, limit: pageSize, offset: nextOffset });
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
        if (!canManage) return;
        void Promise.all([getBaitCatalogMeta(), listBaits({ includeInactive: true, limit: pageSize })])
            .then(([catalogMeta, response]) => {
                setMeta(catalogMeta);
                setRows(response.items);
                setTotal(response.total);
            })
            .catch((caught) => setError(getErrorMessage(caught)));
    }, [canManage]);

    function startCreate() {
        const category = meta.categories.find((item) => item.domain === "bait")?.code ?? "";
        setEditing(null);
        setForm({ ...emptyForm, categoryCode: category });
        setFormError("");
        setFormOpen(true);
    }

    function startEdit(item: Bait) {
        setEditing(item);
        setForm({ name: item.name, domain: item.domain, categoryCode: item.categoryCode ?? "", photo: item.photo ?? "", isActive: item.isActive });
        setFormError("");
        setFormOpen(true);
    }

    function changeFormDomain(nextDomain: BaitDomain) {
        const category = meta.categories.find((item) => item.domain === nextDomain)?.code ?? "";
        setForm((current) => ({ ...current, domain: nextDomain, categoryCode: category }));
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setFormError("");
        setNotice("");
        try {
            if (editing) {
                await updateBait(editing.id, form);
                setNotice("Запись обновлена");
            } else {
                await createBait({
                    ...form,
                    photo: form.photo || null,
                });
                setNotice("Запись создана");
            }
            setFormOpen(false);
            setEditing(null);
            await load(editing ? offset : 0);
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(item: Bait) {
        if (!await confirm({ title: "Удалить запись", message: `Удалить «${item.name}»?`, confirmText: "Удалить", tone: "danger" })) return;
        try {
            await deleteBait(item.id);
            setNotice("Запись удалена");
            await load(rows.length === 1 && offset > 0 ? offset - pageSize : offset);
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    if (!canManage) {
        return <section className="grid gap-4"><div className="rounded-lg border border-border bg-card p-6 text-center"><h2 className="text-xl font-bold">Доступ ограничен</h2><p className="mt-1 text-muted-foreground">Управление каталогом доступно только администраторам.</p>{!currentUser && <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</button>}</div></section>;
    }

    const page = Math.floor(offset / pageSize) + 1;
    const pages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-extrabold uppercase text-primary">Справочник</p><h2 className="text-2xl font-bold">Наживки и приманки</h2><p className="text-sm text-muted-foreground">{total.toLocaleString("ru-RU")} записей</p></div>
                <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus size={16} /> Добавить</button>
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <form className="grid gap-3 border-y border-border py-4 lg:grid-cols-[minmax(240px,1fr)_180px_240px_auto]" onSubmit={(event) => { event.preventDefault(); void load(0); }}>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по названию" />
                <select value={domain} onChange={(event) => { setDomain(event.target.value as BaitDomain | ""); setCategoryCode(""); }}><option value="">Все разделы</option><option value="bait">Наживки</option><option value="lure">Приманки</option></select>
                <select value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)}><option value="">Все категории</option>{filterCategories.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
                <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Найти</button>
            </form>

            {formOpen && <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between"><h3 className="font-bold">{editing ? "Изменить запись" : "Новая запись"}</h3><button type="button" onClick={() => setFormOpen(false)} title="Закрыть"><X size={18} /></button></div>
                {formError && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
                <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-1 text-sm"><span>Название *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={150} /></label>
                    <label className="grid gap-1 text-sm"><span>Раздел *</span><select value={form.domain} onChange={(event) => changeFormDomain(event.target.value as BaitDomain)}><option value="bait">Наживка</option><option value="lure">Приманка</option></select></label>
                    <label className="grid gap-1 text-sm"><span>Категория *</span><select value={form.categoryCode} onChange={(event) => setForm({ ...form, categoryCode: event.target.value })} required><option value="">Выберите категорию</option>{formCategories.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
                </div>
                <PhotoUploadField value={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Показывать пользователям</label>
                <div className="flex gap-2"><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save size={16} /> {submitting ? "Сохранение…" : "Сохранить"}</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Отмена</button></div>
            </form>}

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="p-3">Фото</th><th className="p-3">Название</th><th className="p-3">Раздел</th><th className="p-3">Категория</th><th className="p-3">Статус</th><th className="p-3 text-right">Действия</th></tr></thead>
                    <tbody>{loading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Ничего не найдено</td></tr> : rows.map((item) => <tr key={item.id} className="border-t border-border">
                        <td className="p-3">{item.photo ? <img src={mediaUrl(item.photo)} alt={item.name} title={item.name} className="h-14 w-14 rounded border border-border object-contain" /> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3 font-medium">{item.name}</td><td className="p-3">{baitDomainLabels[item.domain]}</td><td className="p-3">{item.categoryName ?? "—"}</td><td className="p-3">{item.isActive ? "Показывается" : "Скрыта"}</td>
                        <td className="p-3"><div className="flex justify-end gap-2"><button title="Изменить" onClick={() => startEdit(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border"><Pencil size={15} /></button><button title="Удалить" onClick={() => remove(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/40 text-destructive"><Trash2 size={15} /></button></div></td>
                    </tr>)}</tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Страница {page} из {pages}</span><div className="flex gap-2"><button title="Предыдущая страница" disabled={offset === 0 || loading} onClick={() => void load(Math.max(0, offset - pageSize))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={16} /></button><button title="Следующая страница" disabled={offset + pageSize >= total || loading} onClick={() => void load(offset + pageSize)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
            {dialog}
        </section>
    );
}
