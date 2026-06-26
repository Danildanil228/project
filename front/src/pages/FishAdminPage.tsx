import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { PhotoUploadField } from "../components/PhotoUploadField";
import { SelectMenu } from "../components/SelectMenu";
import { mediaUrl } from "../lib/items-api";
import { createFish, createFishBulk, deleteFish, listFish, listWaterbodies, updateFish } from "../lib/reference-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { fishRarities, type Fish, type FishInput, type FishRarity } from "../types/fish";
import type { WaterbodyListRow } from "../types/waterbody";
import { canManageCatalog, getErrorMessage } from "../utils/admin-format";

type FishAdminPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

type FishForm = {
    name: string;
    rarity: FishRarity;
    photo: string;
    waterbodyIds: number[];
    trophyWeightGrams: string;
    rareTrophyWeightGrams: string;
};
type BulkRow = FishForm & { key: number };

const emptyForm: FishForm = {
    name: "",
    rarity: "Обычный",
    photo: "",
    waterbodyIds: [],
    trophyWeightGrams: "",
    rareTrophyWeightGrams: "",
};
let nextBulkKey = 1;

function newBulkRow(): BulkRow {
    return { ...emptyForm, waterbodyIds: [], key: nextBulkKey++ };
}

function WaterbodyPicker({ waterbodies, selected, onChange }: {
    waterbodies: WaterbodyListRow[];
    selected: number[];
    onChange: (ids: number[]) => void;
}) {
    function toggle(id: number) {
        onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
    }

    return (
        <details className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-input bg-background px-3 text-sm">
                {selected.length ? `Выбрано: ${selected.length}` : "Выберите водоёмы"}
            </summary>
            <div className="absolute z-40 mt-1 max-h-64 min-w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                {waterbodies.map((waterbody) => (
                    <label key={waterbody.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted">
                        <input type="checkbox" checked={selected.includes(waterbody.id)} onChange={() => toggle(waterbody.id)} />
                        <span className="whitespace-nowrap">{waterbody.name}</span>
                    </label>
                ))}
            </div>
        </details>
    );
}

function toInput(form: FishForm): FishInput {
    return {
        name: form.name,
        rarity: form.rarity,
        photo: form.photo || null,
        waterbodyIds: form.waterbodyIds,
        trophyWeightGrams: Number(form.trophyWeightGrams),
        rareTrophyWeightGrams: Number(form.rareTrophyWeightGrams),
    };
}

function formatWeight(grams: number | null) {
    if (grams === null) return "—";
    if (grams < 1000) return `${grams.toLocaleString("ru-RU")} г`;
    return `${(grams / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} кг`;
}

export function FishAdminPage({ currentUser, adminContext, onOpenAuthModal }: FishAdminPageProps) {
    const canManage = canManageCatalog(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [rows, setRows] = useState<Fish[]>([]);
    const [waterbodies, setWaterbodies] = useState<WaterbodyListRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [warning, setWarning] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [mode, setMode] = useState<"single" | "bulk">("single");
    const [editing, setEditing] = useState<Fish | null>(null);
    const [form, setForm] = useState<FishForm>(emptyForm);
    const [bulkRows, setBulkRows] = useState<BulkRow[]>([newBulkRow(), newBulkRow(), newBulkRow()]);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [search, setSearch] = useState("");
    const [rarityFilter, setRarityFilter] = useState("");
    const [waterbodyFilter, setWaterbodyFilter] = useState("");
    const [total, setTotal] = useState(0);
    const [resetVersion, setResetVersion] = useState(0);

    async function load() {
        setLoading(true);
        setError("");
        try {
            const [fishResponse, waterbodyResponse] = await Promise.all([
                listFish({ search, rarity: rarityFilter, waterbodyId: waterbodyFilter ? Number(waterbodyFilter) : undefined, limit: 500 }),
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
        if (canManage) void load();
    }, [canManage, resetVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- filters are applied by the form

    function resetFilters() {
        setSearch("");
        setRarityFilter("");
        setWaterbodyFilter("");
        setResetVersion((value) => value + 1);
    }

    function startCreate(selectedMode: "single" | "bulk") {
        setEditing(null);
        setMode(selectedMode);
        setForm({ ...emptyForm, waterbodyIds: [] });
        setBulkRows([newBulkRow(), newBulkRow(), newBulkRow()]);
        setFormError("");
        setWarning("");
        setFormOpen(true);
    }

    function startEdit(fish: Fish) {
        setEditing(fish);
        setMode("single");
        setForm({
            name: fish.name,
            rarity: fish.rarity,
            photo: fish.photo ?? "",
            waterbodyIds: fish.waterbodies.map((item) => item.id),
            trophyWeightGrams: fish.trophyWeightGrams?.toString() ?? "",
            rareTrophyWeightGrams: fish.rareTrophyWeightGrams?.toString() ?? "",
        });
        setFormError("");
        setWarning("");
        setFormOpen(true);
    }

    async function submitSingle(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setFormError("");
        setNotice("");
        setWarning("");
        try {
            if (editing) {
                await updateFish(editing.id, toInput(form));
                setNotice("Рыба обновлена");
            } else {
                const response = await createFish(toInput(form));
                if (response.alreadyExisted) {
                    if (!form.waterbodyIds.length) {
                        setWarning(`Рыба «${response.item.name}» уже существует`);
                    } else if (response.habitatsAdded) {
                        setWarning(`Рыба «${response.item.name}» уже существует. Она добавлена в выбранные водоёмы: ${response.habitatsAdded}`);
                    } else {
                        setWarning(`Рыба «${response.item.name}» уже существует и уже относится к выбранным водоёмам`);
                    }
                } else {
                    setNotice("Рыба создана");
                }
            }
            await load();
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    async function submitBulk(event: FormEvent) {
        event.preventDefault();
        const filled = bulkRows.filter((row) => row.name.trim());
        if (!filled.length) {
            setFormError("Заполните хотя бы одну строку");
            return;
        }
        setSubmitting(true);
        setFormError("");
        setNotice("");
        setWarning("");
        try {
            const response = await createFishBulk(filled.map(toInput));
            if (response.created) setNotice(`Добавлено новых рыб: ${response.created}`);
            if (response.existing) {
                const habitatText = response.habitatsAdded
                    ? ` Для существующих рыб добавлено связей с водоёмами: ${response.habitatsAdded}.`
                    : " Новых связей с водоёмами для них не потребовалось.";
                setWarning(`Уже существовало рыб: ${response.existing}.${habitatText}`);
            }
            await load();
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    function updateBulkRow(key: number, patch: Partial<FishForm>) {
        setBulkRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
    }

    async function remove(fish: Fish) {
        const confirmed = await confirm({ title: "Удалить рыбу", message: `Удалить «${fish.name}»?`, confirmText: "Удалить", tone: "danger" });
        if (!confirmed) return;
        setNotice("");
        setError("");
        try {
            await deleteFish(fish.id);
            setNotice("Рыба удалена");
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    if (!canManage) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <h2 className="text-xl font-bold">Доступ ограничен</h2>
                    <p className="mt-1 text-muted-foreground">Управление справочниками доступно только администраторам.</p>
                    {!currentUser && <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</button>}
                </div>
            </section>
        );
    }

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="grid gap-1">
                    <p className="text-xs font-extrabold uppercase text-primary">Справочник</p>
                    <h2 className="text-2xl font-bold">Управление рыбой</h2>
                    <p className="text-muted-foreground">{total.toLocaleString("ru-RU")} рыб</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => startCreate("bulk")} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold"><Plus size={16} /> Несколько рыб</button>
                    <button onClick={() => startCreate("single")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus size={16} /> Добавить рыбу</button>
                </div>
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {warning && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{warning}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid gap-3 border-y border-border py-4 md:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_190px_240px_auto_auto] lg:items-end">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Поиск по названию</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например, карп" /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Редкость</span><SelectMenu value={rarityFilter} onChange={setRarityFilter} options={[{ value: "", label: "Все" }, ...fishRarities.map((rarity) => ({ value: rarity, label: rarity }))]} /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Водоём обитания</span><SelectMenu value={waterbodyFilter} onChange={setWaterbodyFilter} options={[{ value: "", label: "Все водоёмы" }, ...waterbodies.map((waterbody) => ({ value: String(waterbody.id), label: waterbody.name }))]} /></label>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Search size={16} /> Найти</button>
                <button type="button" onClick={resetFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold"><X size={16} /> Сбросить</button>
            </form>

            {formOpen && mode === "single" && (
                <form onSubmit={submitSingle} className="grid gap-4 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between"><h3 className="font-bold">{editing ? "Изменить рыбу" : "Новая рыба"}</h3><button type="button" title="Закрыть" onClick={() => setFormOpen(false)}><X size={18} /></button></div>
                    {formError && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Название *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={100} /></label>
                        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Редкость *</span><SelectMenu value={form.rarity} onChange={(value) => setForm({ ...form, rarity: value as FishRarity })} options={fishRarities.map((rarity) => ({ value: rarity, label: rarity }))} /></label>
                        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Водоёмы обитания</span><WaterbodyPicker waterbodies={waterbodies} selected={form.waterbodyIds} onChange={(waterbodyIds) => setForm({ ...form, waterbodyIds })} /></label>
                        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Вес трофея, г *</span><input type="number" min="1" max="100000000" step="1" required value={form.trophyWeightGrams} onChange={(event) => setForm({ ...form, trophyWeightGrams: event.target.value })} /></label>
                        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Вес редкого трофея, г *</span><input type="number" min={form.trophyWeightGrams || "1"} max="100000000" step="1" required value={form.rareTrophyWeightGrams} onChange={(event) => setForm({ ...form, rareTrophyWeightGrams: event.target.value })} /></label>
                    </div>
                    <PhotoUploadField value={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
                    <div className="flex gap-2"><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save size={16} /> {submitting ? "Сохранение…" : "Сохранить"}</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Отмена</button></div>
                </form>
            )}

            {formOpen && mode === "bulk" && (
                <form onSubmit={submitBulk} className="grid gap-4 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between"><div><h3 className="font-bold">Добавить несколько рыб</h3><p className="text-sm text-muted-foreground">Пустые строки будут пропущены.</p></div><button type="button" title="Закрыть" onClick={() => setFormOpen(false)}><X size={18} /></button></div>
                    {formError && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
                    <div className="overflow-x-auto">
                        <div className="grid min-w-[1080px] gap-2">
                            <div className="grid grid-cols-[minmax(180px,1fr)_160px_150px_180px_minmax(220px,1fr)_40px] gap-2 px-1 text-xs font-bold text-muted-foreground"><span>Название</span><span>Редкость</span><span>Трофей, г</span><span>Редкий трофей, г</span><span>Водоёмы обитания</span><span /></div>
                            {bulkRows.map((row) => (
                                <div key={row.key} className="grid grid-cols-[minmax(180px,1fr)_160px_150px_180px_minmax(220px,1fr)_40px] items-start gap-2">
                                    <input aria-label="Название рыбы" maxLength={100} value={row.name} onChange={(event) => updateBulkRow(row.key, { name: event.target.value })} />
                                    <SelectMenu value={row.rarity} onChange={(value) => updateBulkRow(row.key, { rarity: value as FishRarity })} options={fishRarities.map((rarity) => ({ value: rarity, label: rarity }))} />
                                    <input aria-label="Вес трофея в граммах" type="number" min="1" max="100000000" step="1" required={Boolean(row.name.trim())} value={row.trophyWeightGrams} onChange={(event) => updateBulkRow(row.key, { trophyWeightGrams: event.target.value })} />
                                    <input aria-label="Вес редкого трофея в граммах" type="number" min={row.trophyWeightGrams || "1"} max="100000000" step="1" required={Boolean(row.name.trim())} value={row.rareTrophyWeightGrams} onChange={(event) => updateBulkRow(row.key, { rareTrophyWeightGrams: event.target.value })} />
                                    <WaterbodyPicker waterbodies={waterbodies} selected={row.waterbodyIds} onChange={(waterbodyIds) => updateBulkRow(row.key, { waterbodyIds })} />
                                    <button type="button" title="Удалить строку" className="grid size-10 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive" onClick={() => setBulkRows((current) => current.filter((item) => item.key !== row.key))}><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setBulkRows((current) => [...current, newBulkRow()])} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold"><Plus size={16} /> Добавить строку</button><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save size={16} /> {submitting ? "Сохранение…" : "Сохранить заполненные"}</button></div>
                </form>
            )}

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground"><th className="p-3">Фото</th><th className="p-3">Название</th><th className="p-3">Редкость</th><th className="p-3">Трофей</th><th className="p-3">Редкий трофей</th><th className="p-3">Водоёмы</th><th className="p-3 text-right">Действия</th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Загрузка…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Пока нет рыбы</td></tr> : rows.map((fish) => (
                            <tr key={fish.id} className="border-t border-border">
                                <td className="p-3">{fish.photo ? <img src={mediaUrl(fish.photo)} alt={fish.name} title={fish.name} className="h-12 w-16 rounded border border-border object-contain" /> : <span className="text-muted-foreground">—</span>}</td>
                                <td className="p-3 font-medium">{fish.name}</td>
                                <td className="p-3 text-muted-foreground">{fish.rarity}</td>
                                <td className="whitespace-nowrap p-3 text-muted-foreground">{formatWeight(fish.trophyWeightGrams)}</td>
                                <td className="whitespace-nowrap p-3 text-muted-foreground">{formatWeight(fish.rareTrophyWeightGrams)}</td>
                                <td className="max-w-sm p-3 text-muted-foreground">{fish.waterbodies.map((item) => item.name).join(", ") || "Не указаны"}</td>
                                <td className="p-3"><div className="flex justify-end gap-2"><button title="Изменить" onClick={() => startEdit(fish)} className="grid size-9 place-items-center rounded-lg border border-border hover:border-primary"><Pencil size={15} /></button><button title="Удалить" onClick={() => remove(fish)} className="grid size-9 place-items-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 size={15} /></button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {dialog}
        </section>
    );
}
