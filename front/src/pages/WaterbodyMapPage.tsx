import { ArrowLeft, ChevronDown, MapPin, Pencil, Plus, Save, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { InteractiveMap, MapAreaOverlay, MapFixedOverlay, type MapPoint } from "../components/InteractiveMap";
import { LoadingImage } from "../components/LoadingImage";
import { MapSkeleton, Skeleton } from "../components/LoadingState";
import { MultiCombobox } from "../components/MultiCombobox";
import { SelectMenu } from "../components/SelectMenu";
import { WaterbodyFishList } from "../components/WaterbodyFishList";
import { ScrollArea } from "../components/ui/scroll-area";
import { postMapLinkingEnabled } from "../lib/features";
import { mediaUrl } from "../lib/items-api";
import { gameToMapPercent, hasCoordinateBounds, mapPercentToGame } from "../lib/map-coordinates";
import { addSpotVariants, createSpot, deleteSpot, getWaterbody, listBaits, listSpots, updateSpot } from "../lib/reference-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { Bait } from "../types/bait";
import {
    spotFishingMethods,
    type FishingSpot,
    type SpotBait,
    type SpotFish,
    type SpotGeometryType,
    type SpotInput,
    type SpotVariant,
    type SpotVariantInput,
} from "../types/spot";
import type { Waterbody } from "../types/waterbody";
import { canManageCatalog, getErrorMessage } from "../utils/admin-format";
import { WaterbodyDetailSkeleton } from "../components/PageSkeletons";

type Props = { currentUser?: ManagedUser; adminContext?: AdminSecurityContext | null };
type VariantForm = SpotVariantInput & { clientId: number };
type SpotForm = Omit<SpotInput, "waterbodyId" | "variants"> & { variants: VariantForm[] };
type CursorCoordinate = { mapX: number; mapY: number; gameX: number; gameY: number };

let nextVariantId = 1;

function createVariant(geometryType: SpotGeometryType): VariantForm {
    return {
        clientId: nextVariantId++,
        fishingMethod: geometryType === "trolling" ? "Троллинг" : "Донка",
        description: null,
        depth: null,
        clipDistance: null,
        fishIds: [],
        baitIds: [],
    };
}

function createEmptyForm(): SpotForm {
    return {
        name: "",
        description: null,
        geometryType: "point",
        mapX: 50,
        mapY: 50,
        gameCoordinateX: null,
        gameCoordinateY: null,
        trollingArea: null,
        variants: [createVariant("point")],
        isActive: true,
    };
}

function optionalNumber(value: string) {
    return value === "" ? null : Number(value);
}

function polygonCenter(points: MapPoint[]) {
    let twiceArea = 0;
    let x = 0;
    let y = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        const factor = current.mapX * next.mapY - next.mapX * current.mapY;
        twiceArea += factor;
        x += (current.mapX + next.mapX) * factor;
        y += (current.mapY + next.mapY) * factor;
    }
    if (Math.abs(twiceArea) < 0.001) {
        return {
            mapX: points.reduce((sum, point) => sum + point.mapX, 0) / points.length,
            mapY: points.reduce((sum, point) => sum + point.mapY, 0) / points.length,
        };
    }
    return { mapX: x / (3 * twiceArea), mapY: y / (3 * twiceArea) };
}

function FishPreview({ items }: { items: SpotFish[] }) {
    if (!items.length) return <p className="text-sm text-muted-foreground">Рыба не указана</p>;
    return <div className="grid gap-2">{items.map((item) => (
        <div key={item.id} title={item.name} className="flex min-w-0 items-center gap-2">
            {item.photo
                ? <LoadingImage src={mediaUrl(item.photo)} alt={item.name} title={item.name} className="size-9 shrink-0" imageClassName="object-contain" />
                : null}
            <span className="min-w-0 truncate text-sm font-medium">{item.name}</span>
        </div>
    ))}</div>;
}

function BaitPreview({ items }: { items: SpotBait[] }) {
    if (!items.length) return <p className="text-sm text-muted-foreground">Приманки не указаны</p>;
    return <div className="flex flex-wrap gap-x-4 gap-y-2">{items.map((item) => (
        <div key={item.id} title={item.name} className="flex min-w-0 items-center gap-2">
            {item.photo
                ? <LoadingImage src={mediaUrl(item.photo)} alt={item.name} title={item.name} className="size-8 shrink-0" imageClassName="object-contain" />
                : null}
            <span className="max-w-44 truncate text-sm">{item.name}</span>
        </div>
    ))}</div>;
}

function VariantDetails({ variant }: { variant: SpotVariant }) {
    return (
        <section className="grid gap-3 border-t border-border px-4 py-4 first:border-t-0">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <p className="text-sm font-bold">{variant.fishingMethod ?? "Вид ловли не указан"}</p>
                {(variant.depth !== null || variant.clipDistance !== null) && <dl className="ml-auto flex shrink-0 gap-5 text-right text-sm">
                    {variant.depth !== null && <div><dt className="text-xs text-muted-foreground">Глубина</dt><dd className="font-bold">{variant.depth} м</dd></div>}
                    {variant.clipDistance !== null && <div><dt className="text-xs text-muted-foreground">Клипса</dt><dd className="font-bold">{variant.clipDistance} м</dd></div>}
                </dl>}
            </div>
            {variant.description && <p className="text-sm text-muted-foreground">{variant.description}</p>}
            <FishPreview items={variant.fish} />
            <div className="grid gap-2 pt-1"><p className="text-xs font-bold text-muted-foreground">Приманка или наживка</p><BaitPreview items={variant.baits} /></div>
        </section>
    );
}

function WaterbodyPageSkeleton() {
    return (
        <section className="grid gap-5" aria-busy="true">
            <div className="grid gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="h-4 w-[28rem] max-w-full" /></div>
            <div className="grid w-full min-w-0 grid-cols-1 items-start justify-between gap-5 lg:grid-cols-[minmax(360px,500px)_minmax(420px,1fr)]">
                <MapSkeleton className="aspect-square min-h-56 w-full max-w-[500px] justify-self-start sm:min-h-72" />
                <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4"><Skeleton className="h-6 w-32" />{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
            </div>
            <div className="grid gap-4 rounded-lg border border-border bg-card p-4"><Skeleton className="h-6 w-48" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div></div>
        </section>
    );
}

export function WaterbodyMapPage({ currentUser, adminContext }: Props) {
    const waterbodyId = Number(useParams().id);
    const canManage = canManageCatalog(currentUser, adminContext);
    const { confirm, dialog } = useConfirmDialog();
    const [waterbody, setWaterbody] = useState<Waterbody | null>(null);
    const [spots, setSpots] = useState<FishingSpot[]>([]);
    const [baits, setBaits] = useState<Bait[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [targetMode, setTargetMode] = useState<"new" | "existing">("new");
    const [existingTargetId, setExistingTargetId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<SpotForm>(() => createEmptyForm());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [cursorCoordinate, setCursorCoordinate] = useState<CursorCoordinate | null>(null);

    async function load(preferredSpotId?: number | null) {
        setLoading(true);
        setError("");
        try {
            const [waterbodyResponse, spotsResponse] = await Promise.all([getWaterbody(waterbodyId), listSpots(waterbodyId, canManage)]);
            setWaterbody(waterbodyResponse.item);
            setSpots(spotsResponse.items);
            const preferred = spotsResponse.items.find((spot) => spot.id === preferredSpotId) ?? spotsResponse.items[0] ?? null;
            setSelectedId(preferred?.id ?? null);
            setExpandedIds(new Set());
            if (canManage) setBaits((await listBaits({ includeInactive: true, limit: 5000 })).items);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (Number.isInteger(waterbodyId) && waterbodyId > 0) void load();
        else { setError("Некорректный идентификатор водоёма"); setLoading(false); }
        // Initial page load and role change only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waterbodyId, canManage]);

    const baitOptions = useMemo(() => baits.map((item) => ({ id: item.id, name: item.name, hint: item.categoryName ?? undefined })), [baits]);
    const fishOptions = useMemo(() => waterbody?.fish.map((item) => ({ id: item.id, name: item.name, hint: item.rarity })) ?? [], [waterbody]);
    const existingTarget = useMemo(() => spots.find((spot) => spot.id === existingTargetId) ?? null, [spots, existingTargetId]);
    const coordinateBounds = waterbody && hasCoordinateBounds(waterbody) ? waterbody : null;

    function snappedMapPoint(point: MapPoint) {
        if (!coordinateBounds) return point;
        const game = mapPercentToGame(point.mapX, point.mapY, coordinateBounds);
        return gameToMapPercent(Math.round(game.x), Math.round(game.y), coordinateBounds);
    }

    function startCreate() {
        const next = createEmptyForm();
        if (coordinateBounds) {
            const game = mapPercentToGame(50, 50, coordinateBounds);
            const rounded = { x: Math.round(game.x), y: Math.round(game.y) };
            Object.assign(next, gameToMapPercent(rounded.x, rounded.y, coordinateBounds), { gameCoordinateX: rounded.x, gameCoordinateY: rounded.y });
        }
        setEditingId(null);
        setFormMode("create");
        setTargetMode("new");
        setExistingTargetId(null);
        setForm(next);
        setFormOpen(true);
        setError("");
        setNotice("");
    }

    function startEdit(spot: FishingSpot) {
        const habitatIds = new Set(waterbody?.fish.map((item) => item.id) ?? []);
        const calibratedMarker = coordinateBounds && spot.gameCoordinateX !== null && spot.gameCoordinateY !== null
            ? gameToMapPercent(spot.gameCoordinateX, spot.gameCoordinateY, coordinateBounds)
            : { mapX: spot.mapX, mapY: spot.mapY };
        setEditingId(spot.id);
        setFormMode("edit");
        setTargetMode("new");
        setExistingTargetId(null);
        setForm({
            name: spot.name,
            description: spot.description,
            geometryType: spot.geometryType,
            ...calibratedMarker,
            gameCoordinateX: spot.gameCoordinateX,
            gameCoordinateY: spot.gameCoordinateY,
            trollingArea: spot.trollingArea,
            variants: spot.variants.map((variant) => ({
                clientId: nextVariantId++,
                fishingMethod: variant.fishingMethod ?? (spot.geometryType === "trolling" ? "Троллинг" : "Донка"),
                description: variant.description,
                depth: variant.depth,
                clipDistance: variant.clipDistance,
                fishIds: variant.fish.map((item) => item.id).filter((id) => habitatIds.has(id)),
                baitIds: variant.baits.map((item) => item.id),
            })),
            isActive: spot.isActive,
        });
        setFormOpen(true);
        setError("");
        setNotice("");
    }

    function selectSpot(spot: FishingSpot) {
        setSelectedId(spot.id);
        setExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(spot.id)) next.delete(spot.id);
            else next.add(spot.id);
            return next;
        });
        if (formOpen && formMode === "create" && targetMode === "existing") {
            setExistingTargetId(spot.id);
            setForm((current) => ({
                ...current,
                geometryType: spot.geometryType,
                variants: current.variants.map((variant) => ({
                    ...variant,
                    fishingMethod: spot.geometryType === "trolling" ? "Троллинг" : variant.fishingMethod === "Троллинг" ? "Донка" : variant.fishingMethod,
                })),
            }));
        }
    }

    function switchTargetMode(mode: "new" | "existing") {
        setTargetMode(mode);
        setExistingTargetId(null);
        const next = createEmptyForm();
        if (mode === "new" && coordinateBounds) {
            const game = mapPercentToGame(50, 50, coordinateBounds);
            const rounded = { x: Math.round(game.x), y: Math.round(game.y) };
            Object.assign(next, gameToMapPercent(rounded.x, rounded.y, coordinateBounds), { gameCoordinateX: rounded.x, gameCoordinateY: rounded.y });
        }
        setForm(next);
    }

    function chooseMap(point: MapPoint) {
        if (!canManage || !formOpen) return;
        if (formMode === "create" && targetMode === "existing") return;
        if (!coordinateBounds) {
            setError("Сначала задайте границы игровых координат в справочнике водоёмов");
            return;
        }
        const marker = snappedMapPoint(point);
        if (form.geometryType === "trolling") {
            setForm((current) => ({ ...current, trollingArea: [...(current.trollingArea ?? []), marker].slice(0, 30) }));
            return;
        }
        const game = mapPercentToGame(marker.mapX, marker.mapY, coordinateBounds);
        setForm((current) => ({ ...current, ...marker, gameCoordinateX: Math.round(game.x), gameCoordinateY: Math.round(game.y) }));
    }

    function trackCoordinate(point: MapPoint) {
        if (!coordinateBounds) return;
        const game = mapPercentToGame(point.mapX, point.mapY, coordinateBounds);
        setCursorCoordinate({ mapX: point.mapX, mapY: point.mapY, gameX: Math.round(game.x), gameY: Math.round(game.y) });
    }

    function updateGameCoordinate(field: "gameCoordinateX" | "gameCoordinateY", value: string) {
        const parsed = optionalNumber(value);
        setForm((current) => {
            const next = { ...current, [field]: parsed };
            if (!coordinateBounds || next.gameCoordinateX === null || next.gameCoordinateY === null) return next;
            return { ...next, ...gameToMapPercent(next.gameCoordinateX, next.gameCoordinateY, coordinateBounds) };
        });
    }

    function changeGeometryType(geometryType: SpotGeometryType) {
        setForm((current) => ({
            ...current,
            geometryType,
            trollingArea: geometryType === "trolling" ? [] : null,
            variants: current.variants.map((variant) => ({
                ...variant,
                fishingMethod: geometryType === "trolling" ? "Троллинг" : variant.fishingMethod === "Троллинг" ? "Донка" : variant.fishingMethod,
            })),
        }));
    }

    function updateVariant(index: number, patch: Partial<VariantForm>) {
        setForm((current) => ({ ...current, variants: current.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant) }));
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!form.variants.length) { setError("Добавьте хотя бы один способ ловли"); return; }

        const variants: SpotVariantInput[] = form.variants.map((variant) => ({
            fishingMethod: variant.fishingMethod,
            description: variant.description,
            depth: variant.depth,
            clipDistance: variant.clipDistance,
            fishIds: variant.fishIds,
            baitIds: variant.baitIds,
        }));

        if (formMode === "create" && targetMode === "existing") {
            if (!existingTargetId) { setError("Выберите существующую метку на карте или в списке"); return; }
            setSubmitting(true);
            setError("");
            try {
                await addSpotVariants(existingTargetId, variants);
                setNotice("Способы ловли добавлены в точку");
                setFormOpen(false);
                await load(existingTargetId);
            } catch (caught) {
                setError(getErrorMessage(caught));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (!coordinateBounds) { setError("Для сохранения настройте границы карты"); return; }

        let location = {
            mapX: form.mapX,
            mapY: form.mapY,
            gameCoordinateX: form.gameCoordinateX,
            gameCoordinateY: form.gameCoordinateY,
        };
        if (form.geometryType === "point") {
            if (form.gameCoordinateX === null || form.gameCoordinateY === null) { setError("Укажите координату точки"); return; }
        } else {
            if (!form.trollingArea || form.trollingArea.length < 3) { setError("Для зоны троллинга поставьте на карте минимум три вершины"); return; }
            const center = polygonCenter(form.trollingArea);
            const game = mapPercentToGame(center.mapX, center.mapY, coordinateBounds);
            location = { ...center, gameCoordinateX: Math.round(game.x), gameCoordinateY: Math.round(game.y) };
        }

        const payload = { ...form, ...location, variants };
        setSubmitting(true);
        setError("");
        try {
            if (formMode === "edit" && editingId) {
                await updateSpot(editingId, payload);
                setNotice("Точка обновлена");
            } else {
                await createSpot({ waterbodyId, ...payload });
                setNotice("Точка создана");
            }
            setFormOpen(false);
            const preferredId = editingId;
            setEditingId(null);
            await load(preferredId);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(spot: FishingSpot) {
        const accepted = await confirm({ title: "Удалить точку", message: `Удалить «${spot.name}» вместе со всеми способами ловли?`, confirmText: "Удалить", tone: "danger" });
        if (!accepted) return;
        try { await deleteSpot(spot.id); setNotice("Точка удалена"); await load(); }
        catch (caught) { setError(getErrorMessage(caught)); }
    }

    if (loading) return <WaterbodyDetailSkeleton />;
    if (!waterbody) return <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error || "Водоём не найден"}</p>;

    const trollingVertices = form.trollingArea ?? [];
    const fishingMethodOptions = (form.geometryType === "trolling" ? ["Троллинг"] : spotFishingMethods.filter((method) => method !== "Троллинг"))
        .map((method) => ({ value: method, label: method }));

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link to="/waterbodies" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Все водоёмы</Link>
                    <h2 className="text-2xl font-bold">{waterbody.name}</h2>
                    <p className="text-muted-foreground">Точки ловли: где стоять, какую рыбу и на что ловить.</p>
                </div>
                {canManage && <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus size={16} /> Добавить точку или способ</button>}
            </div>

            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="grid w-full min-w-0 grid-cols-1 items-start justify-between gap-5 lg:grid-cols-[minmax(360px,500px)_minmax(420px,1fr)]">
                <InteractiveMap
                    imageSrc={waterbody.photo ? mediaUrl(waterbody.photo) : null}
                    imageAlt={`Карта водоёма ${waterbody.name}`}
                    emptyText="Загрузите изображение карты в справочнике водоёмов"
                    className="aspect-square min-h-56 w-full max-w-[500px] justify-self-start sm:min-h-72"
                    onMapClick={chooseMap}
                    onMapPointerMove={trackCoordinate}
                    onMapPointerLeave={() => setCursorCoordinate(null)}
                    role={formOpen && canManage ? "button" : undefined}
                    tabIndex={formOpen && canManage ? 0 : undefined}
                    testId="waterbody-map"
                >
                    {spots.filter((spot) => spot.geometryType === "trolling" && spot.trollingArea).map((spot) => (
                        <MapAreaOverlay key={`area-${spot.id}`} points={spot.trollingArea ?? []} selected={selectedId === spot.id || existingTargetId === spot.id} label={`Зона троллинга: ${spot.name}`} onSelect={() => selectSpot(spot)} />
                    ))}
                    {spots.map((spot) => (
                        <MapFixedOverlay key={spot.id} mapX={spot.mapX} mapY={spot.mapY} className="absolute z-10">
                            <button type="button" title={spot.name} aria-label={`Место: ${spot.name}`} data-testid={`spot-marker-${spot.id}`} onClick={(event) => { event.stopPropagation(); selectSpot(spot); }} className={`grid size-8 place-items-center rounded-full border-2 shadow-sm ${selectedId === spot.id || existingTargetId === spot.id ? "border-primary-foreground bg-primary text-primary-foreground" : "border-background bg-foreground text-background"} ${!spot.isActive ? "opacity-50" : ""}`}><MapPin size={17} /></button>
                        </MapFixedOverlay>
                    ))}
                    {formOpen && !(formMode === "create" && targetMode === "existing") && form.geometryType === "point" && <MapFixedOverlay mapX={form.mapX} mapY={form.mapY} className="pointer-events-none absolute z-20"><div data-testid="draft-spot-marker" className="grid size-8 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow"><MapPin size={17} /></div></MapFixedOverlay>}
                    {formOpen && !(formMode === "create" && targetMode === "existing") && form.geometryType === "trolling" && <MapAreaOverlay points={trollingVertices} draft label="Новая зона троллинга" />}
                    {formOpen && !(formMode === "create" && targetMode === "existing") && form.geometryType === "trolling" && trollingVertices.map((point, index) => <MapFixedOverlay key={`${point.mapX}-${point.mapY}-${index}`} mapX={point.mapX} mapY={point.mapY} transform="translate(-50%, -50%)" className="pointer-events-none absolute z-20"><span className="grid size-6 place-items-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-primary-foreground shadow">{index + 1}</span></MapFixedOverlay>)}
                    {cursorCoordinate && <MapFixedOverlay mapX={cursorCoordinate.mapX} mapY={cursorCoordinate.mapY} transform={`translate(${cursorCoordinate.mapX > 72 ? "calc(-100% - 12px)" : "12px"}, ${cursorCoordinate.mapY > 85 ? "calc(-100% - 12px)" : "12px"})`} data-testid="map-coordinate-tooltip" className="pointer-events-none absolute z-30 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs font-bold text-white shadow">X: {cursorCoordinate.gameX}, Y: {cursorCoordinate.gameY}</MapFixedOverlay>}
                </InteractiveMap>

                <aside className="flex min-w-0 flex-col self-start overflow-hidden rounded-lg border border-border bg-card lg:h-[500px]">
                    <div className="border-b border-border px-4 py-3"><h3 className="font-bold">Точки ловли ({spots.length})</h3></div>
                    <ScrollArea className="min-h-0 flex-1">
                        {spots.length === 0 ? <p className="p-4 text-sm text-muted-foreground">На карте пока нет точек ловли</p> : spots.map((spot) => (
                            <section key={spot.id} className="border-b border-border last:border-b-0">
                                <button
                                    type="button"
                                    onClick={() => selectSpot(spot)}
                                    aria-expanded={expandedIds.has(spot.id)}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${selectedId === spot.id ? "bg-muted" : "hover:bg-muted/60"}`}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold">{spot.name}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {spot.geometryType === "trolling" ? "Троллинг" : `Координаты ${spot.gameCoordinateX ?? "—"} : ${spot.gameCoordinateY ?? "—"}`}
                                        </span>
                                    </span>
                                    <ChevronDown size={17} className={`shrink-0 transition-transform ${expandedIds.has(spot.id) ? "rotate-180" : ""}`} />
                                </button>

                                {expandedIds.has(spot.id) && <div className="border-t border-border bg-background/40">
                                    {spot.description && <p className="px-4 py-3 text-sm text-muted-foreground">{spot.description}</p>}
                                    {spot.variants.length > 0
                                        ? spot.variants.map((variant) => <VariantDetails key={variant.id} variant={variant} />)
                                        : <p className="px-4 py-3 text-sm text-muted-foreground">Для этой точки ещё не указаны условия ловли</p>}
                                    {postMapLinkingEnabled && spot.posts.length > 0 && <div className="grid gap-2 border-t border-border px-4 py-3"><p className="text-xs font-bold text-muted-foreground">Публикации в этом месте ({spot.posts.length})</p>{spot.posts.map((post) => <Link key={post.postId} to={`/posts/${post.postId}`} className="grid gap-1 rounded border border-border p-2 hover:border-primary"><span className="text-xs text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString("ru-RU")} · {post.authorName}</span>{post.targets.map((target) => <span key={target.fishId}><strong>{target.fishName}</strong>{target.baits.length ? ` — ${target.baits.map((bait) => bait.name).join(", ")}` : ""}</span>)}</Link>)}</div>}
                                    {canManage && <div className="flex gap-2 border-t border-border px-4 py-3"><button type="button" onClick={() => startEdit(spot)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-bold"><Pencil size={14} /> Изменить</button><button type="button" onClick={() => remove(spot)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-sm font-bold text-destructive"><Trash2 size={14} /> Удалить</button></div>}
                                </div>}
                            </section>
                        ))}
                    </ScrollArea>
                </aside>
            </div>

            {formOpen && <form onSubmit={submit} className="grid gap-5 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between"><h3 className="font-bold">{formMode === "edit" ? "Изменить точку ловли" : "Добавить условия ловли"}</h3><button type="button" onClick={() => setFormOpen(false)} title="Закрыть"><X size={18} /></button></div>
                {formMode === "create" && <fieldset className="grid gap-1 text-sm"><legend>Куда добавить</legend><div className="flex w-fit items-center rounded-lg border border-border bg-background p-1"><button type="button" onClick={() => switchTargetMode("new")} className={`rounded px-3 py-2 text-sm font-bold ${targetMode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Новая точка</button><button type="button" onClick={() => switchTargetMode("existing")} className={`rounded px-3 py-2 text-sm font-bold ${targetMode === "existing" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Существующая точка</button></div></fieldset>}
                {formMode === "create" && targetMode === "existing" && <div className={`rounded-lg border px-3 py-3 text-sm ${existingTarget ? "border-primary/50 bg-primary/5" : "border-amber-500/40 bg-amber-500/10"}`}>
                    {existingTarget ? <><strong>Выбрано: {existingTarget.name}</strong><span className="ml-2 text-muted-foreground">{existingTarget.geometryType === "trolling" ? "Троллинг" : `${existingTarget.gameCoordinateX ?? "—"} : ${existingTarget.gameCoordinateY ?? "—"}`}</span></> : "Нажмите на существующую метку на карте или выберите точку в списке."}
                </div>}
                {!(formMode === "create" && targetMode === "existing") && <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto]">
                    <label className="grid gap-1 text-sm"><span>Название *</span><input required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <fieldset className="grid gap-1 text-sm"><legend>Тип места</legend><div className="flex h-[42px] items-center rounded-lg border border-border bg-background p-1"><button type="button" onClick={() => changeGeometryType("point")} className={`h-full rounded px-3 text-sm font-bold ${form.geometryType === "point" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Обычная точка</button><button type="button" onClick={() => changeGeometryType("trolling")} className={`h-full rounded px-3 text-sm font-bold ${form.geometryType === "trolling" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Зона троллинга</button></div></fieldset>
                </div>}
                {!(formMode === "create" && targetMode === "existing") && (form.geometryType === "point" ? <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm"><span>Координата X</span><input type="number" step="1" min={coordinateBounds?.coordinateMinX} max={coordinateBounds?.coordinateMaxX} value={form.gameCoordinateX ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateX", event.target.value)} /></label><label className="grid gap-1 text-sm"><span>Координата Y</span><input type="number" step="1" min={coordinateBounds?.coordinateMinY} max={coordinateBounds?.coordinateMaxY} value={form.gameCoordinateY ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateY", event.target.value)} /></label><p className="text-xs text-muted-foreground sm:col-span-2">Нажмите на карту или введите координаты вручную.</p></div> : <div className="flex flex-wrap items-center gap-2 border-y border-border py-3"><span className="mr-auto text-sm">Последовательно поставьте на карте минимум три границы зоны. Сейчас: <strong>{trollingVertices.length}</strong></span><button type="button" disabled={!trollingVertices.length} onClick={() => setForm((current) => ({ ...current, trollingArea: (current.trollingArea ?? []).slice(0, -1) }))} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-40"><Undo2 size={15} /> Отменить</button><button type="button" disabled={!trollingVertices.length} onClick={() => setForm((current) => ({ ...current, trollingArea: [] }))} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-40"><X size={15} /> Очистить</button></div>)}
                {!(formMode === "create" && targetMode === "existing") && <label className="grid gap-1 text-sm"><span>Общее описание точки</span><textarea rows={3} maxLength={3000} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value || null })} /></label>}

                <div className="grid gap-4">
                    <div className="flex items-center justify-between gap-3"><div><h4 className="font-bold">Что и на что ловить</h4><p className="text-xs text-muted-foreground">Для каждого способа укажите вид ловли, рыбу, приманки, глубину и клипсу.</p></div><button type="button" disabled={form.variants.length >= 20} onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, createVariant(current.geometryType)] }))} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-40"><Plus size={15} /> Добавить способ</button></div>
                    {form.variants.map((variant, index) => <section key={variant.clientId} className="grid gap-4 border-t border-border pt-4">
                        <div className="flex items-center justify-between"><h5 className="font-bold">Способ {index + 1}</h5><button type="button" disabled={form.variants.length === 1} onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((_, variantIndex) => variantIndex !== index) }))} title="Удалить способ" className="grid size-9 place-items-center rounded-lg border border-destructive/40 text-destructive disabled:opacity-30"><Trash2 size={15} /></button></div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <label className="grid gap-1 text-sm"><span>Вид ловли *</span><SelectMenu value={variant.fishingMethod} disabled={form.geometryType === "trolling"} options={fishingMethodOptions} onChange={(value) => updateVariant(index, { fishingMethod: value as SpotVariantInput["fishingMethod"] })} /></label>
                            <label className="grid gap-1 text-sm"><span>Глубина, м</span><input type="number" min="0" step="0.01" value={variant.depth ?? ""} onChange={(event) => updateVariant(index, { depth: optionalNumber(event.target.value) })} /></label>
                            <label className="grid gap-1 text-sm"><span>Клипса, м</span><input type="number" min="0" step="1" value={variant.clipDistance ?? ""} onChange={(event) => updateVariant(index, { clipDistance: optionalNumber(event.target.value) })} /></label>
                        </div>
                        <label className="grid gap-1 text-sm"><span>Комментарий к способу</span><textarea rows={2} maxLength={1000} value={variant.description ?? ""} onChange={(event) => updateVariant(index, { description: event.target.value || null })} /></label>
                        <div className="grid gap-4 md:grid-cols-2">
                            <fieldset className="grid content-start gap-2"><legend className="mb-1 text-sm font-bold">Рыба этого водоёма</legend><MultiCombobox options={fishOptions} selected={variant.fishIds} onChange={(fishIds) => updateVariant(index, { fishIds })} placeholder="Добавить рыбу" searchPlaceholder="Поиск рыбы" emptyMessage="Рыба не найдена" /></fieldset>
                            <fieldset className="grid content-start gap-2"><legend className="mb-1 text-sm font-bold">Приманки и наживки</legend><MultiCombobox options={baitOptions} selected={variant.baitIds} onChange={(baitIds) => updateVariant(index, { baitIds })} placeholder="Добавить приманку" searchPlaceholder="Поиск по названию" /></fieldset>
                        </div>
                    </section>)}
                </div>
                {!(formMode === "create" && targetMode === "existing") && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Показывать точку пользователям</label>}
                <div><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save size={16} /> {submitting ? "Сохранение…" : formMode === "create" && targetMode === "existing" ? "Добавить в точку" : "Сохранить"}</button></div>
            </form>}

            <WaterbodyFishList fish={waterbody.fish} />
            {dialog}
        </section>
    );
}
