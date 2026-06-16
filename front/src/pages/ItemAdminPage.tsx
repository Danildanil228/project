import { useEffect, useState } from "react";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { ItemForm } from "../features/items/ItemForm";
import { fetchItems, typeLabels, type ItemType } from "../lib/items-api";
import { createItemRequest, deleteItemRequest, updateItemRequest } from "../lib/items-admin-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type ItemAdminPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

type ItemRow = { id: number; name: string; category: string; brend: string; lvl: number } & Record<string, unknown>;

const itemTypes: ItemType[] = ["reels", "rods"];

export function ItemAdminPage({ currentUser, adminContext, onOpenAuthModal }: ItemAdminPageProps) {
    const canManage = hasElevatedUserAccess(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [type, setType] = useState<ItemType>("reels");
    const [rows, setRows] = useState<ItemRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<ItemRow | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    async function loadRows(nextType: ItemType) {
        setLoading(true);
        setError("");
        try {
            const response = await fetchItems(nextType, { limit: 100, sortBy: "name", sortDirection: "asc" });
            setRows(response.items as ItemRow[]);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!canManage) return;
        void loadRows(type);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, canManage]);

    function changeType(next: ItemType) {
        if (next === type) return;
        setType(next);
        setFormOpen(false);
        setEditing(null);
        setNotice("");
    }

    function startCreate() {
        setEditing(null);
        setFormError("");
        setFormOpen(true);
    }

    function startEdit(row: ItemRow) {
        setEditing(row);
        setFormError("");
        setFormOpen(true);
    }

    async function submitForm(data: Record<string, unknown>) {
        setSubmitting(true);
        setFormError("");
        setNotice("");
        try {
            if (editing) {
                await updateItemRequest(type, editing.id, data);
                setNotice("Предмет обновлён");
            } else {
                await createItemRequest(type, data);
                setNotice("Предмет создан");
            }
            setFormOpen(false);
            setEditing(null);
            await loadRows(type);
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    async function removeRow(row: ItemRow) {
        const confirmed = await confirm({
            title: "Удалить предмет",
            message: `Удалить «${row.name}»? Действие необратимо.`,
            confirmText: "Удалить",
            tone: "danger",
        });
        if (!confirmed) return;
        setNotice("");
        setError("");
        try {
            await deleteItemRequest(type, row.id);
            setNotice("Предмет удалён");
            await loadRows(type);
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    if (!canManage) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <h2 className="text-xl font-bold">Доступ ограничен</h2>
                    <p className="mt-1 text-muted-foreground">Управление снастями доступно администраторам и модераторам.</p>
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
            <div className="grid gap-1">
                <p className="text-xs font-extrabold uppercase text-primary">Администрирование</p>
                <h2 className="text-2xl font-bold">Управление снастями</h2>
                <p className="text-muted-foreground">Добавление, редактирование и удаление предметов каталога.</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
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
                <button type="button" onClick={startCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    + Добавить
                </button>
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {formOpen && (
                <ItemForm
                    key={editing ? `edit-${editing.id}` : `create-${type}`}
                    type={type}
                    initial={editing}
                    submitting={submitting}
                    error={formError}
                    onSubmit={submitForm}
                    onCancel={() => {
                        setFormOpen(false);
                        setEditing(null);
                    }}
                />
            )}

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-muted-foreground">
                            <th className="p-3">Название</th>
                            <th className="p-3">Категория</th>
                            <th className="p-3">Бренд</th>
                            <th className="p-3">Ур.</th>
                            <th className="p-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                    Загрузка…
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                    Пока нет предметов
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.id} className="border-t border-border">
                                    <td className="p-3 font-medium">{row.name}</td>
                                    <td className="p-3 text-muted-foreground">{row.category}</td>
                                    <td className="p-3 text-muted-foreground">{row.brend}</td>
                                    <td className="p-3 text-muted-foreground">{row.lvl}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => startEdit(row)}
                                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary"
                                            >
                                                Изменить
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeRow(row)}
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
