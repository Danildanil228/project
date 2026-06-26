import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { InteractiveMap } from "./InteractiveMap";
import { mediaUrl } from "../lib/items-api";
import { getWaterbody } from "../lib/reference-api";
import type { Waterbody } from "../types/waterbody";

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

    useEffect(() => {
        let cancelled = false;
        setError(null);
        getWaterbody(waterbodyId)
            .then((response) => { if (!cancelled) setWaterbody(response.item); })
            .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Не удалось загрузить водоём"); });
        return () => { cancelled = true; };
    }, [waterbodyId]);

    if (error) return <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
    if (!waterbody) return <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">Загрузка карты…</p>;

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
            >
                {/* Trolling A→B dashed line drawn under the markers */}
                {trolling && (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1={mapX!} y1={mapY!} x2={mapX2!} y2={mapY2!} stroke="#dc2626" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                    </svg>
                )}

                {hasPointA && (
                    <div
                        className="pointer-events-none absolute z-10 grid size-8 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow"
                        style={{ left: `${mapX}%`, top: `${mapY}%` }}
                        title={gameCoordinateX != null && gameCoordinateY != null ? `${gameCoordinateX}:${gameCoordinateY}` : undefined}
                    ><MapPin size={17} /></div>
                )}
                {trolling && (
                    <div
                        className="pointer-events-none absolute z-10 grid size-8 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 border-background bg-blue-600 text-white shadow"
                        style={{ left: `${mapX2}%`, top: `${mapY2}%` }}
                        title={gameCoordinateX2 != null && gameCoordinateY2 != null ? `${gameCoordinateX2}:${gameCoordinateY2}` : undefined}
                    ><MapPin size={17} /></div>
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
