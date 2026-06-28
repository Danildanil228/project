import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { InteractiveMap, MapFixedOverlay, type MapPoint } from "./InteractiveMap";
import { mediaUrl } from "../lib/items-api";
import { hasCoordinateBounds, mapPercentToGame } from "../lib/map-coordinates";
import { getWaterbody } from "../lib/reference-api";
import type { Waterbody } from "../types/waterbody";
import { MapSkeleton } from "./LoadingState";

// Read-only counterpart to PostLocationPicker. Shows the waterbody map and the marker(s) the
// author placed when creating the post. Two markers + dashed line when this is a trolling post.
type Props = {
    waterbodyId: number;
    mapX: number | null;
    mapY: number | null;
    mapX2: number | null;
    mapY2: number | null;
    gameCoordinateX?: number | null;
    gameCoordinateY?: number | null;
    gameCoordinateX2?: number | null;
    gameCoordinateY2?: number | null;
};

export function PostLocationView({ waterbodyId, mapX, mapY, mapX2, mapY2, gameCoordinateX, gameCoordinateY, gameCoordinateX2, gameCoordinateY2 }: Props) {
    const [waterbody, setWaterbody] = useState<Waterbody | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState<{ mapX: number; mapY: number; gameX: number; gameY: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        getWaterbody(waterbodyId)
            .then((response) => { if (!cancelled) setWaterbody(response.item); })
            .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Не удалось загрузить водоём"); });
        return () => { cancelled = true; };
    }, [waterbodyId]);

    const bounds = useMemo(() => waterbody && hasCoordinateBounds(waterbody) ? waterbody : null, [waterbody]);

    function trackCoordinate(point: MapPoint) {
        if (!bounds) return;
        const game = mapPercentToGame(point.mapX, point.mapY, bounds);
        setCursor({ mapX: point.mapX, mapY: point.mapY, gameX: Math.round(game.x), gameY: Math.round(game.y) });
    }

    if (error) return <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
    if (!waterbody) return <MapSkeleton className="min-h-64" />;

    const hasPointA = mapX !== null && mapY !== null;
    const hasPointB = mapX2 !== null && mapY2 !== null;
    const trolling = hasPointA && hasPointB;

    return (
        <div className="grid gap-2">
            <InteractiveMap
                imageSrc={waterbody.photo ? mediaUrl(waterbody.photo) : null}
                imageAlt={`Карта водоёма ${waterbody.name}`}
                emptyText="У водоёма нет изображения карты"
                className="aspect-square min-h-64"
                onMapPointerMove={trackCoordinate}
                onMapPointerLeave={() => setCursor(null)}
                testId="post-location-map"
            >
                {/* Trolling A→B dashed line drawn under the markers */}
                {trolling && (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1={mapX!} y1={mapY!} x2={mapX2!} y2={mapY2!} stroke="#dc2626" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    </svg>
                )}

                {hasPointA && (
                    <MapFixedOverlay
                        mapX={mapX}
                        mapY={mapY}
                        className="pointer-events-none absolute z-10"
                        title={gameCoordinateX != null && gameCoordinateY != null ? `${gameCoordinateX}:${gameCoordinateY}` : undefined}
                    >
                        <div className="grid size-8 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow"><MapPin size={17} /></div>
                    </MapFixedOverlay>
                )}
                {trolling && (
                    <MapFixedOverlay
                        mapX={mapX2!}
                        mapY={mapY2!}
                        className="pointer-events-none absolute z-10"
                        title={gameCoordinateX2 != null && gameCoordinateY2 != null ? `${gameCoordinateX2}:${gameCoordinateY2}` : undefined}
                    >
                        <div className="grid size-8 place-items-center rounded-full border-2 border-background bg-blue-600 text-white shadow"><MapPin size={17} /></div>
                    </MapFixedOverlay>
                )}
                {cursor && (
                    <MapFixedOverlay
                        mapX={cursor.mapX}
                        mapY={cursor.mapY}
                        transform={`translate(${cursor.mapX > 72 ? "calc(-100% - 12px)" : "12px"}, ${cursor.mapY > 85 ? "calc(-100% - 12px)" : "12px"})`}
                        className="pointer-events-none absolute z-30 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs font-bold text-white shadow"
                    >
                        X: {cursor.gameX}, Y: {cursor.gameY}
                    </MapFixedOverlay>
                )}
            </InteractiveMap>
            {trolling ? (
                <p className="text-xs text-muted-foreground">
                    Троллинг А→Б{gameCoordinateX != null && gameCoordinateY != null && gameCoordinateX2 != null && gameCoordinateY2 != null ? `: ${gameCoordinateX}:${gameCoordinateY} → ${gameCoordinateX2}:${gameCoordinateY2}` : ""}
                </p>
            ) : hasPointA && gameCoordinateX != null && gameCoordinateY != null ? (
                <p className="text-xs text-muted-foreground">Точка: {gameCoordinateX}:{gameCoordinateY}</p>
            ) : null}
        </div>
    );
}
