import { MapPin, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InteractiveMap, type MapPoint } from "./InteractiveMap";
import { mediaUrl } from "../lib/items-api";
import { gameToMapPercent, hasCoordinateBounds, mapPercentToGame } from "../lib/map-coordinates";
import { getWaterbody, listSpots } from "../lib/reference-api";
import type { FishingSpot } from "../types/spot";
import type { Waterbody } from "../types/waterbody";
import { getErrorMessage } from "../utils/admin-format";

export type PostLocationValue = {
    proposedSpotId: number | null;
    mapX: number | null;
    mapY: number | null;
    gameCoordinateX: number | null;
    gameCoordinateY: number | null;
    // Optional second point — only used in "trolling" mode (range from A to B).
    mapX2: number | null;
    mapY2: number | null;
    gameCoordinateX2: number | null;
    gameCoordinateY2: number | null;
};

type Props = {
    waterbodyId: number;
    value: PostLocationValue;
    onChange: (value: PostLocationValue) => void;
};

type CursorCoordinate = { mapX: number; mapY: number; gameX: number; gameY: number };

export const emptyPostLocation: PostLocationValue = {
    proposedSpotId: null,
    mapX: null,
    mapY: null,
    gameCoordinateX: null,
    gameCoordinateY: null,
    mapX2: null,
    mapY2: null,
    gameCoordinateX2: null,
    gameCoordinateY2: null,
};

export function PostLocationPicker({ waterbodyId, value, onChange }: Props) {
    const [waterbody, setWaterbody] = useState<Waterbody | null>(null);
    const [spots, setSpots] = useState<FishingSpot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cursor, setCursor] = useState<CursorCoordinate | null>(null);
    // Picker mode — single point or trolling range A→B.
    const mode: "point" | "trolling" = value.mapX2 !== null || value.gameCoordinateX2 !== null ? "trolling" : "point";
    const [pendingMode, setPendingMode] = useState<"point" | "trolling">(mode);

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        setError("");
        Promise.all([getWaterbody(waterbodyId), listSpots(waterbodyId)])
            .then(([waterbodyResponse, spotsResponse]) => {
                if (ignore) return;
                setWaterbody(waterbodyResponse.item);
                setSpots(spotsResponse.items);
            })
            .catch((caught) => {
                if (!ignore) setError(getErrorMessage(caught));
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => { ignore = true; };
    }, [waterbodyId]);

    const bounds = useMemo(() => waterbody && hasCoordinateBounds(waterbody) ? waterbody : null, [waterbody]);

    function chooseNewLocation(point: MapPoint) {
        if (!bounds) return;
        const game = mapPercentToGame(point.mapX, point.mapY, bounds);
        const gameCoordinateX = Math.round(game.x);
        const gameCoordinateY = Math.round(game.y);
        const marker = gameToMapPercent(gameCoordinateX, gameCoordinateY, bounds);

        if (pendingMode === "trolling") {
            // Trolling rule: if A is empty, set A. If A is set but B empty, set B. If both set, restart from A.
            if (value.mapX === null) {
                onChange({ ...value, proposedSpotId: null, ...marker, gameCoordinateX, gameCoordinateY });
                return;
            }
            if (value.mapX2 === null) {
                onChange({ ...value, mapX2: marker.mapX, mapY2: marker.mapY, gameCoordinateX2: gameCoordinateX, gameCoordinateY2: gameCoordinateY });
                return;
            }
            // Both A and B already set → next click resets and starts a fresh A.
            onChange({
                proposedSpotId: null,
                ...marker,
                gameCoordinateX,
                gameCoordinateY,
                mapX2: null, mapY2: null, gameCoordinateX2: null, gameCoordinateY2: null,
            });
            return;
        }

        // Single-point mode — always replaces A and clears B (which shouldn't be set here, but be safe).
        onChange({
            ...value,
            proposedSpotId: null,
            ...marker,
            gameCoordinateX,
            gameCoordinateY,
            mapX2: null, mapY2: null, gameCoordinateX2: null, gameCoordinateY2: null,
        });
    }

    function selectSpot(spot: FishingSpot) {
        // Existing spots are always point-mode — switch UI accordingly.
        setPendingMode("point");
        onChange({
            proposedSpotId: spot.id,
            mapX: spot.mapX,
            mapY: spot.mapY,
            gameCoordinateX: spot.gameCoordinateX,
            gameCoordinateY: spot.gameCoordinateY,
            mapX2: null, mapY2: null, gameCoordinateX2: null, gameCoordinateY2: null,
        });
    }

    function updateGameCoordinate(field: "gameCoordinateX" | "gameCoordinateY" | "gameCoordinateX2" | "gameCoordinateY2", raw: string) {
        const parsed = raw === "" ? null : Number(raw);
        const next = { ...value, proposedSpotId: null, [field]: parsed };
        // Recompute the affected pair's map-percent marker whenever both X and Y are present.
        if (field === "gameCoordinateX" || field === "gameCoordinateY") {
            if (bounds && next.gameCoordinateX !== null && next.gameCoordinateY !== null) {
                onChange({ ...next, ...gameToMapPercent(next.gameCoordinateX, next.gameCoordinateY, bounds) });
                return;
            }
            onChange({ ...next, mapX: null, mapY: null });
            return;
        }
        if (bounds && next.gameCoordinateX2 !== null && next.gameCoordinateY2 !== null) {
            const m = gameToMapPercent(next.gameCoordinateX2, next.gameCoordinateY2, bounds);
            onChange({ ...next, mapX2: m.mapX, mapY2: m.mapY });
            return;
        }
        onChange({ ...next, mapX2: null, mapY2: null });
    }

    function switchToMode(next: "point" | "trolling") {
        setPendingMode(next);
        if (next === "point") {
            // Drop B when switching back to point mode.
            onChange({ ...value, mapX2: null, mapY2: null, gameCoordinateX2: null, gameCoordinateY2: null });
        }
    }

    function trackCoordinate(point: MapPoint) {
        if (!bounds) return;
        const game = mapPercentToGame(point.mapX, point.mapY, bounds);
        setCursor({ mapX: point.mapX, mapY: point.mapY, gameX: Math.round(game.x), gameY: Math.round(game.y) });
    }

    if (loading) return <div className="grid min-h-64 place-items-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">Загрузка карты…</div>;
    if (!waterbody) return <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error || "Водоём не найден"}</p>;

    const trollingActive = pendingMode === "trolling";
    const needsB = trollingActive && value.mapX !== null && value.mapX2 === null;

    return (
        <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="font-bold">Место ловли на карте</h3>
                    <p className="text-xs text-muted-foreground">
                        {trollingActive
                            ? (needsB
                                ? "Нажмите на карту, чтобы поставить точку Б (конец траектории троллинга)."
                                : "Нажмите на карту, чтобы поставить точку А (начало троллинга). Повторный клик после Б — сброс.")
                            : "Необязательно. Выберите существующую точку или нажмите на карту."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Mode toggle — single point vs trolling A→B */}
                    <div className="inline-flex rounded-lg border border-border p-1 text-xs">
                        <button type="button" onClick={() => switchToMode("point")} className={`rounded px-2.5 py-1 ${!trollingActive ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}>Точка</button>
                        <button type="button" onClick={() => switchToMode("trolling")} className={`rounded px-2.5 py-1 ${trollingActive ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}>Троллинг A→B</button>
                    </div>
                    {(value.mapX !== null || value.mapX2 !== null) && (
                        <button type="button" onClick={() => onChange(emptyPostLocation)} title="Убрать место с карты" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {!bounds && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">Для этого водоёма ещё не настроены границы игровых координат.</p>}
            <InteractiveMap
                imageSrc={waterbody.photo ? mediaUrl(waterbody.photo) : null}
                imageAlt={`Карта водоёма ${waterbody.name}`}
                emptyText="У водоёма нет изображения карты"
                className="aspect-square min-h-64"
                onMapClick={chooseNewLocation}
                onMapPointerMove={trackCoordinate}
                onMapPointerLeave={() => setCursor(null)}
                role={bounds ? "button" : undefined}
                testId="post-location-map"
            >
                {/* Trolling line — SVG overlay between A and B, drawn under markers */}
                {trollingActive && value.mapX !== null && value.mapY !== null && value.mapX2 !== null && value.mapY2 !== null && (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Literal hex — Tailwind CSS vars don't resolve when used as a raw SVG `stroke` attribute in every browser. */}
                        <line x1={value.mapX} y1={value.mapY} x2={value.mapX2} y2={value.mapY2} stroke="#dc2626" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    </svg>
                )}

                {spots.map((spot) => (
                    <button
                        key={spot.id}
                        type="button"
                        title={spot.name}
                        onClick={(event) => { event.stopPropagation(); selectSpot(spot); }}
                        className={`absolute grid size-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 shadow ${value.proposedSpotId === spot.id ? "border-primary-foreground bg-primary text-primary-foreground" : "border-background bg-foreground text-background"}`}
                        style={{ left: `${spot.mapX}%`, top: `${spot.mapY}%` }}
                    ><MapPin size={15} /></button>
                ))}

                {/* Marker A (and the only marker in point mode) */}
                {value.mapX !== null && value.mapY !== null && value.proposedSpotId === null && (
                    <div
                        className="pointer-events-none absolute z-10 grid size-8 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow"
                        style={{ left: `${value.mapX}%`, top: `${value.mapY}%` }}
                    ><MapPin size={17} /></div>
                )}
                {/* Marker B — trolling only */}
                {trollingActive && value.mapX2 !== null && value.mapY2 !== null && (
                    <div
                        className="pointer-events-none absolute z-10 grid size-8 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 border-background bg-blue-600 text-white shadow"
                        style={{ left: `${value.mapX2}%`, top: `${value.mapY2}%` }}
                    ><MapPin size={17} /></div>
                )}

                {cursor && <div className="pointer-events-none absolute z-30 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs font-bold text-white" style={{ left: `${cursor.mapX}%`, top: `${cursor.mapY}%`, transform: `translate(${cursor.mapX > 72 ? "calc(-100% - 12px)" : "12px"}, ${cursor.mapY > 85 ? "calc(-100% - 12px)" : "12px"})` }}>X: {cursor.gameX}, Y: {cursor.gameY}</div>}
            </InteractiveMap>

            {/* Coordinate inputs — one pair for point mode, two pairs for trolling */}
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">{trollingActive ? "X (точка А)" : "Координата X"}</span><input type="number" step="1" min={bounds?.coordinateMinX} max={bounds?.coordinateMaxX} value={value.gameCoordinateX ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateX", event.target.value)} /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">{trollingActive ? "Y (точка А)" : "Координата Y"}</span><input type="number" step="1" min={bounds?.coordinateMinY} max={bounds?.coordinateMaxY} value={value.gameCoordinateY ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateY", event.target.value)} /></label>
                {trollingActive && (
                    <>
                        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">X (точка Б)</span><input type="number" step="1" min={bounds?.coordinateMinX} max={bounds?.coordinateMaxX} value={value.gameCoordinateX2 ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateX2", event.target.value)} /></label>
                        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Y (точка Б)</span><input type="number" step="1" min={bounds?.coordinateMinY} max={bounds?.coordinateMaxY} value={value.gameCoordinateY2 ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateY2", event.target.value)} /></label>
                    </>
                )}
            </div>
            {value.proposedSpotId !== null && <p className="text-xs text-muted-foreground">Выбрана существующая точка: <strong className="text-foreground">{spots.find((spot) => spot.id === value.proposedSpotId)?.name}</strong></p>}
        </div>
    );
}
