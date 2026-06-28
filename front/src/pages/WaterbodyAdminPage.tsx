import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { PhotoUploadField } from "../components/PhotoUploadField";
import { LoadingImage } from "../components/LoadingImage";
import { TableRowsSkeleton } from "../components/LoadingState";
import { mediaUrl } from "../lib/items-api";
import { createWaterbody, deleteWaterbody, getWaterbody, listFish, listWaterbodies, updateWaterbody } from "../lib/reference-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { Fish } from "../types/fish";
import type { WaterbodyListRow } from "../types/waterbody";
import { canManageCatalog, getErrorMessage } from "../utils/admin-format";

type WaterbodyAdminPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

export function WaterbodyAdminPage({ currentUser, adminContext, onOpenAuthModal }: WaterbodyAdminPageProps) {
    const canManage = canManageCatalog(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [rows, setRows] = useState<WaterbodyListRow[]>([]);
    const [allFish, setAllFish] = useState<Fish[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [photo, setPhoto] = useState("");
    const [coordinateMinX, setCoordinateMinX] = useState("");
    const [coordinateMinY, setCoordinateMinY] = useState("");
    const [coordinateMaxX, setCoordinateMaxX] = useState("");
    const [coordinateMaxY, setCoordinateMaxY] = useState("");
    const [selectedFishIds, setSelectedFishIds] = useState<number[]>([]);
    const [fishSearch, setFishSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    async function load() {
        setLoading(true);
        setError("");
        try {
            const [waterbodies, fish] = await Promise.all([listWaterbodies({ limit: 200 }), listFish({ limit: 500 })]);
            setRows(waterbodies.items);
            setAllFish(fish.items);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (canManage) void load();
    }, [canManage]);

    function resetForm() {
        setName("");
        setPhoto("");
        setCoordinateMinX("");
        setCoordinateMinY("");
        setCoordinateMaxX("");
        setCoordinateMaxY("");
        setSelectedFishIds([]);
        setFishSearch("");
        setFormError("");
    }

    function startCreate() {
        setEditingId(null);
        resetForm();
        setFormOpen(true);
    }

    async function startEdit(row: WaterbodyListRow) {
        setEditingId(row.id);
        resetForm();
        setFormOpen(true);
        try {
            const { item } = await getWaterbody(row.id);
            setName(item.name);
            setPhoto(item.photo ?? "");
            setCoordinateMinX(item.coordinateMinX?.toString() ?? "");
            setCoordinateMinY(item.coordinateMinY?.toString() ?? "");
            setCoordinateMaxX(item.coordinateMaxX?.toString() ?? "");
            setCoordinateMaxY(item.coordinateMaxY?.toString() ?? "");
            setSelectedFishIds(item.fish.map((fish) => fish.id));
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        }
    }

    function toggleFish(id: number) {
        setSelectedFishIds((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setFormError("");
        setNotice("");
        try {
            const toNumber = (value: string) => value === "" ? null : Number(value);
            const payload = {
                name,
                photo: photo || null,
                coordinateMinX: toNumber(coordinateMinX),
                coordinateMinY: toNumber(coordinateMinY),
                coordinateMaxX: toNumber(coordinateMaxX),
                coordinateMaxY: toNumber(coordinateMaxY),
                fishIds: selectedFishIds,
            };
            if (editingId) {
                await updateWaterbody(editingId, payload);
                setNotice("Водоём обновлён");
            } else {
                await createWaterbody(payload);
                setNotice("Водоём создан");
            }
            setFormOpen(false);
            setEditingId(null);
            await load();
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(row: WaterbodyListRow) {
        const confirmed = await confirm({ title: "Удалить водоём", message: `Удалить «${row.name}»?`, confirmText: "Удалить", tone: "danger" });
        if (!confirmed) return;
        setNotice("");
        setError("");
        try {
            await deleteWaterbody(row.id);
            setNotice("Водоём удалён");
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    const filteredFish = useMemo(() => {
        const query = fishSearch.trim().toLowerCase();
        if (!query) return allFish;
        return allFish.filter((fish) => fish.name.toLowerCase().includes(query));
    }, [allFish, fishSearch]);

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
                    <h2 className="text-2xl font-bold">Управление водоёмами</h2>
                    <p className="text-muted-foreground">Название, фото и какие рыбы водятся в водоёме.</p>
                </div>
                <button onClick={startCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    + Добавить водоём
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
                            <input value={name} onChange={(event) => setName(event.target.value)} required />
                        </label>
                        <PhotoUploadField value={photo} onChange={setPhoto} label="Карта водоёма" />
                    </div>

                    <fieldset className="grid gap-3 border-y border-border py-4">
                        <legend className="px-2 text-sm font-bold">Границы игровых координат</legend>
                        <p className="text-sm text-muted-foreground">Минимум — левая и нижняя границы карты, максимум — правая и верхняя.</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="grid gap-1 text-sm"><span>Минимум X</span><input type="number" step="0.01" value={coordinateMinX} onChange={(event) => setCoordinateMinX(event.target.value)} /></label>
                            <label className="grid gap-1 text-sm"><span>Минимум Y</span><input type="number" step="0.01" value={coordinateMinY} onChange={(event) => setCoordinateMinY(event.target.value)} /></label>
                            <label className="grid gap-1 text-sm"><span>Максимум X</span><input type="number" step="0.01" value={coordinateMaxX} onChange={(event) => setCoordinateMaxX(event.target.value)} /></label>
                            <label className="grid gap-1 text-sm"><span>Максимум Y</span><input type="number" step="0.01" value={coordinateMaxY} onChange={(event) => setCoordinateMaxY(event.target.value)} /></label>
                        </div>
                    </fieldset>

                    <div className="grid gap-2 text-sm">
                        <span className="text-muted-foreground">Какие рыбы водятся (выбрано: {selectedFishIds.length})</span>
                        <input placeholder="Поиск рыбы…" value={fishSearch} onChange={(event) => setFishSearch(event.target.value)} />
                        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                            {allFish.length === 0 ? (
                                <p className="p-3 text-muted-foreground">Сначала добавьте рыбу в справочник</p>
                            ) : filteredFish.length === 0 ? (
                                <p className="p-3 text-muted-foreground">Ничего не найдено</p>
                            ) : (
                                filteredFish.map((fish) => (
                                    <label key={fish.id} className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted">
                                        <input type="checkbox" className="size-4 w-auto" checked={selectedFishIds.includes(fish.id)} onChange={() => toggleFish(fish.id)} />
                                        <span className="font-medium">{fish.name}</span>
                                        <span className="text-xs text-muted-foreground">{fish.rarity}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                            {submitting ? "Сохранение…" : "Сохранить"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFormOpen(false);
                                setEditingId(null);
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
                            <th className="p-3">Видов рыб</th>
                            <th className="p-3">Точек</th>
                            <th className="p-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableRowsSkeleton columns={5} rows={7} />
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                    Пока нет водоёмов
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.id} className="border-t border-border">
                                    <td className="p-3">
                                        {row.photo ? (
                                            <LoadingImage src={mediaUrl(row.photo)} alt={row.name} className="h-10 w-10 rounded" imageClassName="object-cover" />
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="p-3 font-medium">{row.name}</td>
                                    <td className="p-3 text-muted-foreground">{row.fishCount}</td>
                                    <td className="p-3 text-muted-foreground">{row.spotCount}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/waterbodies/${row.id}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                                <ExternalLink size={14} /> Карта
                                            </Link>
                                            <button onClick={() => startEdit(row)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">
                                                Изменить
                                            </button>
                                            <button
                                                onClick={() => remove(row)}
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
