import { useEffect, useState, type FormEvent } from "react";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { PhotoUploadField } from "../components/PhotoUploadField";
import { mediaUrl } from "../lib/items-api";
import { createFish, deleteFish, listFish, updateFish } from "../lib/reference-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { fishRarities, type Fish } from "../types/fish";
import { canManageCatalog, getErrorMessage } from "../utils/admin-format";

type FishAdminPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

const emptyForm = { name: "", rarity: "Обычный" as string, photo: "" };

export function FishAdminPage({ currentUser, adminContext, onOpenAuthModal }: FishAdminPageProps) {
    const canManage = canManageCatalog(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [rows, setRows] = useState<Fish[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Fish | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    async function load() {
        setLoading(true);
        setError("");
        try {
            const response = await listFish({ limit: 200 });
            setRows(response.items);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (canManage) void load();
    }, [canManage]);

    function startCreate() {
        setEditing(null);
        setForm(emptyForm);
        setFormError("");
        setFormOpen(true);
    }

    function startEdit(fish: Fish) {
        setEditing(fish);
        setForm({ name: fish.name, rarity: fish.rarity, photo: fish.photo ?? "" });
        setFormError("");
        setFormOpen(true);
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setFormError("");
        setNotice("");
        try {
            const payload = { name: form.name, rarity: form.rarity, photo: form.photo || null };
            if (editing) {
                await updateFish(editing.id, payload);
                setNotice("Рыба обновлена");
            } else {
                await createFish(payload);
                setNotice("Рыба создана");
            }
            setFormOpen(false);
            setEditing(null);
            await load();
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
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
                    {!currentUser && (
                        <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                            Войти
                        </button>
                    )}
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
                    <p className="text-muted-foreground">Название, редкость и фото рыбы.</p>
                </div>
                <button onClick={startCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    + Добавить рыбу
                </button>
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {formOpen && (
                <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
                    {formError && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm">
                            <span className="text-muted-foreground">Название *</span>
                            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="text-muted-foreground">Редкость *</span>
                            <select value={form.rarity} onChange={(event) => setForm({ ...form, rarity: event.target.value })}>
                                {fishRarities.map((rarity) => (
                                    <option key={rarity} value={rarity}>
                                        {rarity}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <PhotoUploadField value={form.photo} onChange={(url) => setForm({ ...form, photo: url })} />
                    <div className="flex gap-2">
                        <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                            {submitting ? "Сохранение…" : "Сохранить"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFormOpen(false);
                                setEditing(null);
                            }}
                            className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
                        >
                            Отмена
                        </button>
                    </div>
                </form>
            )}

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-muted-foreground">
                            <th className="p-3">Фото</th>
                            <th className="p-3">Название</th>
                            <th className="p-3">Редкость</th>
                            <th className="p-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                                    Загрузка…
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                                    Пока нет рыбы
                                </td>
                            </tr>
                        ) : (
                            rows.map((fish) => (
                                <tr key={fish.id} className="border-t border-border">
                                    <td className="p-3">
                                        {fish.photo ? (
                                            <img src={mediaUrl(fish.photo)} alt="" className="h-10 w-10 rounded object-cover" />
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="p-3 font-medium">{fish.name}</td>
                                    <td className="p-3 text-muted-foreground">{fish.rarity}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => startEdit(fish)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                                Изменить
                                            </button>
                                            <button
                                                onClick={() => remove(fish)}
                                                className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                                            >
                                                Удалить
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {dialog}
        </section>
    );
}
