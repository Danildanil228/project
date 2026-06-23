import { MapPin, X } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent, type PointerEvent } from "react";
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
};

export function PostLocationPicker({ waterbodyId, value, onChange }: Props) {
    const [waterbody, setWaterbody] = useState<Waterbody | null>(null);
    const [spots, setSpots] = useState<FishingSpot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cursor, setCursor] = useState<CursorCoordinate | null>(null);

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

    function chooseNewLocation(event: MouseEvent<HTMLDivElement>) {
        if (!bounds) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const clickedMapX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
        const clickedMapY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
        const game = mapPercentToGame(clickedMapX, clickedMapY, bounds);
        const gameCoordinateX = Math.round(game.x);
        const gameCoordinateY = Math.round(game.y);
        const marker = gameToMapPercent(gameCoordinateX, gameCoordinateY, bounds);
        onChange({ proposedSpotId: null, ...marker, gameCoordinateX, gameCoordinateY });
    }

    function selectSpot(spot: FishingSpot) {
        onChange({
            proposedSpotId: spot.id,
            mapX: spot.mapX,
            mapY: spot.mapY,
            gameCoordinateX: spot.gameCoordinateX,
            gameCoordinateY: spot.gameCoordinateY,
        });
    }

    function updateGameCoordinate(field: "gameCoordinateX" | "gameCoordinateY", raw: string) {
        const parsed = raw === "" ? null : Number(raw);
        const next = { ...value, proposedSpotId: null, [field]: parsed };
        if (bounds && next.gameCoordinateX !== null && next.gameCoordinateY !== null) {
            onChange({ ...next, ...gameToMapPercent(next.gameCoordinateX, next.gameCoordinateY, bounds) });
            return;
        }
        onChange({ ...next, mapX: null, mapY: null });
    }

    function trackCoordinate(event: PointerEvent<HTMLDivElement>) {
        if (!bounds) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const mapX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
        const mapY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
        const game = mapPercentToGame(mapX, mapY, bounds);
        setCursor({ mapX, mapY, gameX: Math.round(game.x), gameY: Math.round(game.y) });
    }

    if (loading) return <div className="grid min-h-64 place-items-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">Загрузка карты…</div>;
    if (!waterbody) return <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error || "Водоём не найден"}</p>;

    return (
        <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="font-bold">Место ловли на карте</h3>
                    <p className="text-xs text-muted-foreground">Необязательно. Выберите существующую точку или нажмите на карту.</p>
                </div>
                {value.mapX !== null && (
                    <button type="button" onClick={() => onChange(emptyPostLocation)} title="Убрать место с карты" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
                        <X size={16} />
                    </button>
                )}
            </div>

            {!bounds && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">Для этого водоёма ещё не настроены границы игровых координат.</p>}
            <div
                className="relative aspect-square min-h-64 overflow-hidden rounded-lg border border-border bg-muted"
                onClick={chooseNewLocation}
                onPointerMove={trackCoordinate}
                onPointerLeave={() => setCursor(null)}
                role={bounds ? "button" : undefined}
                data-testid="post-location-map"
            >
                {waterbody.photo ? <img src={mediaUrl(waterbody.photo)} alt={`Карта водоёма ${waterbody.name}`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">У водоёма нет изображения карты</div>}
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
                {value.mapX !== null && value.mapY !== null && value.proposedSpotId === null && <div className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-destructive shadow" style={{ left: `${value.mapX}%`, top: `${value.mapY}%` }} />}
                {cursor && <div className="pointer-events-none absolute z-30 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs font-bold text-white" style={{ left: `${cursor.mapX}%`, top: `${cursor.mapY}%`, transform: `translate(${cursor.mapX > 72 ? "calc(-100% - 12px)" : "12px"}, ${cursor.mapY > 85 ? "calc(-100% - 12px)" : "12px"})` }}>X: {cursor.gameX}, Y: {cursor.gameY}</div>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Координата X</span><input type="number" step="1" min={bounds?.coordinateMinX} max={bounds?.coordinateMaxX} value={value.gameCoordinateX ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateX", event.target.value)} /></label>
                <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Координата Y</span><input type="number" step="1" min={bounds?.coordinateMinY} max={bounds?.coordinateMaxY} value={value.gameCoordinateY ?? ""} onChange={(event) => updateGameCoordinate("gameCoordinateY", event.target.value)} /></label>
            </div>
            {value.proposedSpotId !== null && <p className="text-xs text-muted-foreground">Выбрана существующая точка: <strong className="text-foreground">{spots.find((spot) => spot.id === value.proposedSpotId)?.name}</strong></p>}
        </div>
    );
}
