import { ArrowLeft, MapPin, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type MouseEvent, type PointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { MultiCombobox } from "../components/MultiCombobox";
import { mediaUrl } from "../lib/items-api";
import { gameToMapPercent, hasCoordinateBounds, mapPercentToGame } from "../lib/map-coordinates";
import { postMapLinkingEnabled } from "../lib/features";
import { createSpot, deleteSpot, getWaterbody, listBaits, listSpots, updateSpot } from "../lib/reference-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { Bait } from "../types/bait";
import type { FishingSpot, SpotInput } from "../types/spot";
import type { Waterbody } from "../types/waterbody";
import { canManageCatalog, getErrorMessage } from "../utils/admin-format";

type Props = { currentUser?: ManagedUser; adminContext?: AdminSecurityContext | null };
type SpotForm = Omit<SpotInput, "waterbodyId">;
type CursorCoordinate = { mapX: number; mapY: number; gameX: number; gameY: number };

const emptyForm: SpotForm = {
    name: "",
    description: null,
    mapX: 50,
    mapY: 50,
    gameCoordinateX: null,
    gameCoordinateY: null,
    depth: null,
    clipDistance: null,
    fishIds: [],
    baitIds: [],
    isActive: true,
};

function optionalNumber(value: string) {
    return value === "" ? null : Number(value);
}

function fishCountLabel(count: number) {
    return `Рыб: ${count}`;
}

export function WaterbodyMapPage({ currentUser, adminContext }: Props) {
    const waterbodyId = Number(useParams().id);
    const canManage = canManageCatalog(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [waterbody, setWaterbody] = useState<Waterbody | null>(null);
    const [spots, setSpots] = useState<FishingSpot[]>([]);
    const [baits, setBaits] = useState<Bait[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<SpotForm>(emptyForm);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [cursorCoordinate, setCursorCoordinate] = useState<CursorCoordinate | null>(null);

    async function load() {
        setLoading(true);
        setError("");
        try {
            const [waterbodyResponse, spotsResponse] = await Promise.all([
                getWaterbody(waterbodyId),
                listSpots(waterbodyId, canManage),
            ]);
            setWaterbody(waterbodyResponse.item);
            setSpots(spotsResponse.items);
            setSelectedId((current) => current && spotsResponse.items.some((spot) => spot.id === current) ? current : spotsResponse.items[0]?.id ?? null);
            if (canManage) {
                const baitResponse = await listBaits({ includeInactive: true, limit: 5000 });
                setBaits(baitResponse.items);
            }
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (Number.isInteger(waterbodyId) && waterbodyId > 0) void load();
        else {
            setError("Некорректный идентификатор водоёма");
            setLoading(false);
        }
        // Initial page load and role change only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waterbodyId, canManage]);

    const baitOptions = useMemo(
        () => baits.map((item) => ({ id: item.id, name: item.name, hint: item.categoryName ?? undefined })),
        [baits],
    );

    const selected = useMemo(() => spots.find((spot) => spot.id === selectedId) ?? null, [spots, selectedId]);
    const coordinateBounds = waterbody && hasCoordinateBounds(waterbody) ? waterbody : null;

    function startCreate() {
        setEditingId(null);
        if (coordinateBounds) {
            const game = mapPercentToGame(50, 50, coordinateBounds);
            const roundedGame = { x: Math.round(game.x), y: Math.round(game.y) };
            const marker = gameToMapPercent(roundedGame.x, roundedGame.y, coordinateBounds);
            setForm({ ...emptyForm, ...marker, gameCoordinateX: roundedGame.x, gameCoordinateY: roundedGame.y });
        } else {
            setForm(emptyForm);
        }
        setFormOpen(true);
        setNotice("");
    }

    function startEdit(spot: FishingSpot) {
        const habitatIds = new Set(waterbody?.fish.map((item) => item.id) ?? []);
        const calibratedMarker = coordinateBounds && spot.gameCoordinateX !== null && spot.gameCoordinateY !== null
            ? gameToMapPercent(spot.gameCoordinateX, spot.gameCoordinateY, coordinateBounds)
            : { mapX: spot.mapX, mapY: spot.mapY };
        setEditingId(spot.id);
        setForm({
            name: spot.name,
            description: spot.description,
            ...calibratedMarker,
            gameCoordinateX: spot.gameCoordinateX,
            gameCoordinateY: spot.gameCoordinateY,
            depth: spot.depth,
            clipDistance: spot.clipDistance,
            fishIds: spot.fish.map((item) => item.id).filter((id) => habitatIds.has(id)),
            baitIds: spot.baits.map((item) => item.id),
            isActive: spot.isActive,
        });
        setFormOpen(true);
    }

    function chooseMarker(event: MouseEvent<HTMLDivElement>) {
        if (!canManage || !formOpen) return;
        if (!coordinateBounds) {
            setError("Сначала задайте границы игровых координат в справочнике водоёмов");
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const clickedMapX = ((event.clientX - rect.left) / rect.width) * 100;
        const clickedMapY = ((event.clientY - rect.top) / rect.height) * 100;
        const game = mapPercentToGame(clickedMapX, clickedMapY, coordinateBounds);
        const roundedGame = { x: Math.round(game.x), y: Math.round(game.y) };
        const marker = gameToMapPercent(roundedGame.x, roundedGame.y, coordinateBounds);
        setForm((current) => ({ ...current, ...marker, gameCoordinateX: roundedGame.x, gameCoordinateY: roundedGame.y }));
    }

    function trackCoordinate(event: PointerEvent<HTMLDivElement>) {
        if (!coordinateBounds) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const mapX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
        const mapY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
        const game = mapPercentToGame(mapX, mapY, coordinateBounds);
        setCursorCoordinate({ mapX, mapY, gameX: Math.round(game.x), gameY: Math.round(game.y) });
    }

    function updateGameCoordinate(field: "gameCoordinateX" | "gameCoordinateY", value: string) {
        const parsed = optionalNumber(value);
        setForm((current) => {
            const next = { ...current, [field]: parsed };
            if (!coordinateBounds || next.gameCoordinateX === null || next.gameCoordinateY === null) return next;
            return { ...next, ...gameToMapPercent(next.gameCoordinateX, next.gameCoordinateY, coordinateBounds) };
        });
    }

    function toggleId(field: "fishIds" | "baitIds", id: number) {
        setForm((current) => ({
            ...current,
            [field]: current[field].includes(id) ? current[field].filter((value) => value !== id) : [...current[field], id],
        }));
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!coordinateBounds || form.gameCoordinateX === null || form.gameCoordinateY === null) {
            setError("Для сохранения настройте границы карты и укажите игровую координату точки");
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            if (editingId) {
                await updateSpot(editingId, form);
                setNotice("Точка обновлена");
            } else {
                await createSpot({ waterbodyId, ...form });
                setNotice("Точка создана");
            }
            setFormOpen(false);
            setEditingId(null);
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(spot: FishingSpot) {
        const accepted = await confirm({ title: "Удалить точку", message: `Удалить «${spot.name}»?`, confirmText: "Удалить", tone: "danger" });
        if (!accepted) return;
        try {
            await deleteSpot(spot.id);
            setNotice("Точка удалена");
            await load();
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    if (loading) return <p className="py-12 text-center text-muted-foreground">Загрузка карты…</p>;
    if (!waterbody) return <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error || "Водоём не найден"}</p>;

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link to="/waterbodies" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Все водоёмы</Link>
                    <h2 className="text-2xl font-bold">{waterbody.name}</h2>
                    <p className="text-muted-foreground">Точки ловли, целевая рыба и рабочие приманки.</p>
                </div>
                {canManage && <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus size={16} /> Добавить точку</button>}
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div
                    className="relative aspect-square min-h-64 overflow-hidden rounded-lg border border-border bg-muted sm:min-h-80"
                    onClick={chooseMarker}
                    onPointerMove={trackCoordinate}
                    onPointerLeave={() => setCursorCoordinate(null)}
                    role={formOpen && canManage ? "button" : undefined}
                    tabIndex={formOpen && canManage ? 0 : undefined}
                    data-testid="waterbody-map"
                >
                    {waterbody.photo ? (
                        <img src={mediaUrl(waterbody.photo)} alt={`Карта водоёма ${waterbody.name}`} className="absolute inset-0 h-full w-full object-contain" />
                    ) : (
                        <div className="grid h-full place-items-center p-8 text-center text-muted-foreground">Загрузите изображение карты в справочнике водоёмов</div>
                    )}
                    {spots.map((spot) => (
                        <button
                            key={spot.id}
                            type="button"
                            title={spot.name}
                            aria-label={`Точка: ${spot.name}`}
                            data-testid={`spot-marker-${spot.id}`}
                            onClick={(event) => { event.stopPropagation(); setSelectedId(spot.id); }}
                            className={`absolute grid size-8 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 shadow-sm ${selectedId === spot.id ? "border-primary-foreground bg-primary text-primary-foreground" : "border-background bg-foreground text-background"} ${!spot.isActive ? "opacity-50" : ""}`}
                            style={{ left: `${spot.mapX}%`, top: `${spot.mapY}%` }}
                        ><MapPin size={17} /></button>
                    ))}
                    {formOpen && <div data-testid="draft-spot-marker" className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-destructive shadow" style={{ left: `${form.mapX}%`, top: `${form.mapY}%` }} />}
                    {cursorCoordinate && (
                        <div
                            data-testid="map-coordinate-tooltip"
                            className="pointer-events-none absolute z-30 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs font-bold text-white shadow"
                            style={{
                                left: `${cursorCoordinate.mapX}%`,
                                top: `${cursorCoordinate.mapY}%`,
                                transform: `translate(${cursorCoordinate.mapX > 72 ? "calc(-100% - 12px)" : "12px"}, ${cursorCoordinate.mapY > 85 ? "calc(-100% - 12px)" : "12px"})`,
                            }}
                        >
                            X: {cursorCoordinate.gameX}, Y: {cursorCoordinate.gameY}
                        </div>
                    )}
                </div>

                <aside className="min-w-0 rounded-lg border border-border bg-card">
                    <div className="border-b border-border px-4 py-3"><h3 className="font-bold">Точки ({spots.length})</h3></div>
                    <div className="max-h-48 overflow-y-auto border-b border-border">
                        {spots.length === 0 ? <p className="p-4 text-sm text-muted-foreground">На карте пока нет точек</p> : spots.map((spot) => (
                            <button key={spot.id} onClick={() => setSelectedId(spot.id)} className={`flex w-full items-center justify-between border-b border-border px-4 py-3 text-left text-sm last:border-b-0 ${selectedId === spot.id ? "bg-muted" : "hover:bg-muted/60"}`}>
                                <span className="font-medium">{spot.name}</span><span className="text-xs text-muted-foreground">{fishCountLabel(spot.fish.length)}</span>
                            </button>
                        ))}
                    </div>
                    {selected && <div className="grid gap-3 p-4 text-sm">
                        <div className="flex items-start justify-between gap-2"><h3 className="text-base font-bold">{selected.name}</h3>{!selected.isActive && <span className="text-xs text-muted-foreground">Черновик</span>}</div>
                        {selected.description && <p className="text-muted-foreground">{selected.description}</p>}
                        <dl className="grid grid-cols-2 gap-2">
                            <div><dt className="text-xs text-muted-foreground">Координаты</dt><dd>{selected.gameCoordinateX ?? "—"} : {selected.gameCoordinateY ?? "—"}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Глубина</dt><dd>{selected.depth === null ? "—" : `${selected.depth} м`}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Клипса</dt><dd>{selected.clipDistance === null ? "—" : `${selected.clipDistance} м`}</dd></div>
                        </dl>
                        <div className="grid gap-2">
                            <p className="text-xs text-muted-foreground">Рыба</p>
                            {selected.fish.length ? <div className="flex flex-wrap gap-2">
                                {selected.fish.map((item) => (
                                    <div key={item.id} title={item.name} className="grid w-20 gap-1 text-center">
                                        {item.photo ? <img src={mediaUrl(item.photo)} alt={item.name} className="h-16 w-20 rounded border border-border bg-background object-contain" /> : <div className="flex h-16 w-20 items-center justify-center rounded border border-border text-xs text-muted-foreground">Нет фото</div>}
                                        <span className="line-clamp-2 text-xs">{item.name}</span>
                                    </div>
                                ))}
                            </div> : <p>Не указана</p>}
                        </div>
                        <div className="grid gap-2">
                            <p className="text-xs text-muted-foreground">Приманки</p>
                            {selected.baits.length ? <div className="flex flex-wrap gap-2">
                                {selected.baits.map((item) => (
                                    <div key={item.id} title={item.name} className="grid w-20 gap-1 text-center">
                                        {item.photo ? <img src={mediaUrl(item.photo)} alt={item.name} className="h-16 w-20 rounded border border-border bg-background object-contain" /> : <div className="flex h-16 w-20 items-center justify-center rounded border border-border text-xs text-muted-foreground">Нет фото</div>}
                                        <span className="line-clamp-2 text-xs">{item.name}</span>
                                    </div>
                                ))}
                            </div> : <p>Не указаны</p>}
                        </div>
                        {postMapLinkingEnabled && selected.posts.length > 0 && <div className="grid gap-2 border-t border-border pt-3">
                            <p className="text-xs font-bold text-muted-foreground">Публикации в этой точке ({selected.posts.length})</p>
                            {selected.posts.map((post) => <Link key={post.postId} to={`/posts/${post.postId}`} className="grid gap-1 rounded-lg border border-border p-2 hover:border-primary">
                                <span className="text-xs text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString("ru-RU")} · {post.authorName}</span>
                                {post.targets.map((target) => <span key={target.fishId}><strong>{target.fishName}</strong>{target.baits.length ? ` — ${target.baits.map((bait) => bait.name).join(", ")}` : ""}</span>)}
                            </Link>)}
                        </div>}
                        {canManage && <div className="flex gap-2 border-t border-border pt-3">
                            <button onClick={() => startEdit(selected)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-bold"><Pencil size={14} /> Изменить</button>
                            <button onClick={() => remove(selected)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 font-bold text-destructive"><Trash2 size={14} /> Удалить</button>
                        </div>}
                    </div>}
                </aside>
            </div>

            {formOpen && <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between"><h3 className="font-bold">{editingId ? "Изменить точку" : "Новая точка"}</h3><button type="button" onClick={() => setFormOpen(false)} title="Закрыть"><X size={18} /></button></div>
                <p className="text-sm text-muted-foreground">Нажмите на карту или введите игровую координату — маркер обновится автоматически.</p>
                {!coordinateBounds && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">Для точного размещения настройте границы координат этого водоёма.</p>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-1 text-sm sm:col-span-2"><span>Название *</span><input required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <label className="grid gap-1 text-sm"><span>Координата X</span><input type="number" step="1" min={coordinateBounds?.coordinateMinX} max={coordinateBounds?.coordinateMaxX} value={form.gameCoordinateX ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateX", event.target.value)} /></label>
                    <label className="grid gap-1 text-sm"><span>Координата Y</span><input type="number" step="1" min={coordinateBounds?.coordinateMinY} max={coordinateBounds?.coordinateMaxY} value={form.gameCoordinateY ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateY", event.target.value)} /></label>
                    <label className="grid gap-1 text-sm"><span>Глубина, м</span><input type="number" min="0" step="0.01" value={form.depth ?? ""} onChange={(event) => setForm({ ...form, depth: optionalNumber(event.target.value) })} /></label>
                    <label className="grid gap-1 text-sm"><span>Клипса, м</span><input type="number" min="0" step="1" value={form.clipDistance ?? ""} onChange={(event) => setForm({ ...form, clipDistance: optionalNumber(event.target.value) })} /></label>
                </div>
                <label className="grid gap-1 text-sm"><span>Описание</span><textarea rows={3} maxLength={3000} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value || null })} /></label>
                <div className="grid gap-4 md:grid-cols-2">
                    <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-bold">Рыба этого водоёма</legend><div className="max-h-52 overflow-y-auto rounded-lg border border-border">{waterbody.fish.length ? waterbody.fish.map((item) => <label key={item.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"><input type="checkbox" checked={form.fishIds.includes(item.id)} onChange={() => toggleId("fishIds", item.id)} /><span>{item.name}</span></label>) : <p className="p-3 text-sm text-muted-foreground">Сначала добавьте рыб в список обитателей водоёма</p>}</div></fieldset>
                    <fieldset className="grid content-start gap-2"><legend className="mb-1 text-sm font-bold">Приманки</legend><MultiCombobox options={baitOptions} selected={form.baitIds} onChange={(baitIds) => setForm((current) => ({ ...current, baitIds }))} placeholder="Добавить приманку" searchPlaceholder="Поиск по названию" /></fieldset>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Показывать точку пользователям</label>
                <div><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save size={16} /> {submitting ? "Сохранение…" : "Сохранить"}</button></div>
            </form>}
            {dialog}
        </section>
    );
}
