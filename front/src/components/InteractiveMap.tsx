import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type HTMLAttributes,
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
} from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { LoadingImage } from "./LoadingImage";

export type MapPoint = { mapX: number; mapY: number };

type InteractiveMapProps = {
    imageSrc: string | null;
    imageAlt: string;
    emptyText: string;
    children?: ReactNode;
    className?: string;
    role?: string;
    tabIndex?: number;
    testId?: string;
    onMapClick?: (point: MapPoint, event: MouseEvent<HTMLDivElement>) => void;
    onMapPointerMove?: (point: MapPoint, event: PointerEvent<HTMLDivElement>) => void;
    onMapPointerLeave?: () => void;
};

type MapFixedOverlayProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
    mapX: number;
    mapY: number;
    transform?: string;
    style?: CSSProperties;
};

type ViewState = { scale: number; x: number; y: number };
type PinchState = {
    startDistance: number;
    startScale: number;
    contentX: number;
    contentY: number;
};

const minScale = 1;
const maxScale = 4;
const scaleStep = 0.25;
const MapScaleContext = createContext(1);

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Keeps markers and coordinate tooltips at a stable screen size while their position follows the map. */
export function MapFixedOverlay({ mapX, mapY, transform = "translate(-50%, -100%)", style, ...props }: MapFixedOverlayProps) {
    const scale = useContext(MapScaleContext);
    return (
        <div
            {...props}
            style={{
                ...style,
                left: `${mapX}%`,
                top: `${mapY}%`,
                transform: `scale(${1 / scale}) ${transform}`,
                transformOrigin: "0 0",
            }}
        />
    );
}

export function InteractiveMap({
    imageSrc,
    imageAlt,
    emptyText,
    children,
    className = "",
    role,
    tabIndex,
    testId,
    onMapClick,
    onMapPointerMove,
    onMapPointerLeave,
}: InteractiveMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pointersRef = useRef(new Map<number, { x: number; y: number }>());
    const panRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    const pinchRef = useRef<PinchState | null>(null);
    const movedRef = useRef(false);
    const suppressClickRef = useRef(false);
    const [view, setViewState] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
    const viewRef = useRef(view);

    const setView = useCallback((updater: (current: ViewState) => ViewState) => {
        setViewState((current) => {
            const next = updater(current);
            viewRef.current = next;
            return next;
        });
    }, []);

    const clampView = useCallback((next: ViewState, rect: DOMRect): ViewState => {
        if (next.scale <= 1) return { scale: 1, x: 0, y: 0 };
        return {
            scale: next.scale,
            x: clamp(next.x, rect.width * (1 - next.scale), 0),
            y: clamp(next.y, rect.height * (1 - next.scale), 0),
        };
    }, []);

    const zoomAt = useCallback((requestedScale: number, clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setView((current) => {
            const nextScale = clamp(Number(requestedScale.toFixed(2)), minScale, maxScale);
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;
            const contentX = (localX - current.x) / current.scale;
            const contentY = (localY - current.y) / current.scale;
            return clampView({
                scale: nextScale,
                x: localX - contentX * nextScale,
                y: localY - contentY * nextScale,
            }, rect);
        });
    }, [clampView, setView]);

    const zoomFromCenter = useCallback((delta: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        zoomAt(viewRef.current.scale + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }, [zoomAt]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            zoomAt(viewRef.current.scale + (event.deltaY > 0 ? -scaleStep : scaleStep), event.clientX, event.clientY);
        };
        element.addEventListener("wheel", handleWheel, { passive: false });
        return () => element.removeEventListener("wheel", handleWheel);
    }, [zoomAt]);

    function toMapPoint(clientX: number, clientY: number): MapPoint | null {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const current = viewRef.current;
        return {
            mapX: clamp(((clientX - rect.left - current.x) / current.scale / rect.width) * 100, 0, 100),
            mapY: clamp(((clientY - rect.top - current.y) / current.scale / rect.height) * 100, 0, 100),
        };
    }

    function beginPinch() {
        const rect = containerRef.current?.getBoundingClientRect();
        const points = [...pointersRef.current.values()];
        if (!rect || points.length < 2) return;
        const center = midpoint(points[0], points[1]);
        const current = viewRef.current;
        pinchRef.current = {
            startDistance: Math.max(distance(points[0], points[1]), 1),
            startScale: current.scale,
            contentX: (center.x - rect.left - current.x) / current.scale,
            contentY: (center.y - rect.top - current.y) / current.scale,
        };
        panRef.current = null;
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if ((event.target as HTMLElement).closest("button,a,input,textarea")) return;
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture(event.pointerId);
        movedRef.current = false;

        if (pointersRef.current.size >= 2) {
            beginPinch();
            return;
        }
        if (viewRef.current.scale > 1) {
            panRef.current = {
                x: event.clientX,
                y: event.clientY,
                offsetX: viewRef.current.x,
                offsetY: viewRef.current.y,
            };
        }
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        if (pointersRef.current.has(event.pointerId)) {
            pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }

        const rect = containerRef.current?.getBoundingClientRect();
        const points = [...pointersRef.current.values()];
        if (rect && points.length >= 2 && pinchRef.current) {
            event.preventDefault();
            const center = midpoint(points[0], points[1]);
            const pinch = pinchRef.current;
            const nextScale = clamp(pinch.startScale * distance(points[0], points[1]) / pinch.startDistance, minScale, maxScale);
            setView(() => clampView({
                scale: nextScale,
                x: center.x - rect.left - pinch.contentX * nextScale,
                y: center.y - rect.top - pinch.contentY * nextScale,
            }, rect));
            movedRef.current = true;
        } else if (rect && panRef.current && viewRef.current.scale > 1) {
            event.preventDefault();
            const pan = panRef.current;
            const dx = event.clientX - pan.x;
            const dy = event.clientY - pan.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
            setView((current) => clampView({
                ...current,
                x: pan.offsetX + dx,
                y: pan.offsetY + dy,
            }, rect));
        }

        const point = toMapPoint(event.clientX, event.clientY);
        if (point) onMapPointerMove?.(point, event);
    }

    function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        pointersRef.current.delete(event.pointerId);
        suppressClickRef.current = suppressClickRef.current || movedRef.current || pinchRef.current !== null;
        pinchRef.current = null;
        panRef.current = null;

        const remaining = [...pointersRef.current.values()];
        if (remaining.length >= 2) beginPinch();
        else if (remaining.length === 1 && viewRef.current.scale > 1) {
            panRef.current = {
                x: remaining[0].x,
                y: remaining[0].y,
                offsetX: viewRef.current.x,
                offsetY: viewRef.current.y,
            };
        }
    }

    function handleClick(event: MouseEvent<HTMLDivElement>) {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        const point = toMapPoint(event.clientX, event.clientY);
        if (point) onMapClick?.(point, event);
    }

    function resetView() {
        setView(() => ({ scale: 1, x: 0, y: 0 }));
    }

    return (
        <div
            ref={containerRef}
            className={`relative touch-none overflow-hidden rounded-lg border border-border bg-muted ${view.scale > 1 ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={onMapPointerLeave}
            onClick={handleClick}
            role={role}
            tabIndex={tabIndex}
            data-testid={testId}
        >
            <MapScaleContext.Provider value={view.scale}>
                <div
                    className="absolute inset-0"
                    style={{
                        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                        transformOrigin: "top left",
                    }}
                >
                    {imageSrc ? (
                        <LoadingImage
                            src={imageSrc}
                            alt={imageAlt}
                            className="absolute inset-0 h-full w-full select-none"
                            imageClassName="object-contain"
                            draggable={false}
                        />
                    ) : (
                        <div className="grid h-full place-items-center p-8 text-center text-muted-foreground">{emptyText}</div>
                    )}
                    {children}
                </div>
            </MapScaleContext.Provider>

            <div className="absolute right-2 top-2 z-40 flex items-center overflow-hidden rounded-md border border-border bg-background/95 shadow">
                <button type="button" onClick={(event) => { event.stopPropagation(); zoomFromCenter(-scaleStep); }} disabled={view.scale <= minScale} title="Уменьшить" className="grid size-8 place-items-center disabled:opacity-40"><Minus size={15} /></button>
                <button type="button" onClick={(event) => { event.stopPropagation(); resetView(); }} disabled={view.scale === 1} title="Сбросить масштаб" className="flex h-8 min-w-14 items-center justify-center gap-1 border-x border-border px-1.5 text-xs font-bold disabled:opacity-60"><RotateCcw size={13} /> {Math.round(view.scale * 100)}%</button>
                <button type="button" onClick={(event) => { event.stopPropagation(); zoomFromCenter(scaleStep); }} disabled={view.scale >= maxScale} title="Увеличить" className="grid size-8 place-items-center disabled:opacity-40"><Plus size={15} /></button>
            </div>
        </div>
    );
}
