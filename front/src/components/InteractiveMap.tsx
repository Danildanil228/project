import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";

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

const minScale = 1;
const maxScale = 4;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
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
    const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
    const suppressClickRef = useRef(false);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const clampOffset = useCallback((next: { x: number; y: number }, nextScale = scale) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || nextScale <= 1) return { x: 0, y: 0 };
        return {
            x: clamp(next.x, rect.width - rect.width * nextScale, 0),
            y: clamp(next.y, rect.height - rect.height * nextScale, 0),
        };
    }, [scale]);

    function toMapPoint(clientX: number, clientY: number): MapPoint | null {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        return {
            mapX: clamp(((clientX - rect.left - offset.x) / scale / rect.width) * 100, 0, 100),
            mapY: clamp(((clientY - rect.top - offset.y) / scale / rect.height) * 100, 0, 100),
        };
    }

    const handleWheel = useCallback((event: WheelEvent) => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        setScale((current) => {
            const nextScale = clamp(Number((current + direction * 0.25).toFixed(2)), minScale, maxScale);
            setOffset((offsetCurrent) => clampOffset(offsetCurrent, nextScale));
            return nextScale;
        });
    }, [clampOffset]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        element.addEventListener("wheel", handleWheel, { passive: false });
        return () => element.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (scale <= 1 || event.button !== 0) return;
        if ((event.target as HTMLElement).closest("button,a,input,select,textarea")) return;
        dragRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        if (dragRef.current) {
            const dx = event.clientX - dragRef.current.x;
            const dy = event.clientY - dragRef.current.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
            setOffset(clampOffset({ x: dragRef.current.offsetX + dx, y: dragRef.current.offsetY + dy }));
        }

        const point = toMapPoint(event.clientX, event.clientY);
        if (point) onMapPointerMove?.(point, event);
    }

    function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
        if (dragRef.current) {
            suppressClickRef.current = dragRef.current.moved;
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
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
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }

    return (
        <div
            ref={containerRef}
            className={`relative touch-none overflow-hidden rounded-lg border border-border bg-muted ${scale > 1 ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => {
                dragRef.current = null;
                onMapPointerLeave?.();
            }}
            onClick={handleClick}
            role={role}
            tabIndex={tabIndex}
            data-testid={testId}
        >
            <div
                className="absolute inset-0"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: "top left",
                }}
            >
                {imageSrc ? (
                    <img src={imageSrc} alt={imageAlt} className="absolute inset-0 h-full w-full select-none object-contain" draggable={false} />
                ) : (
                    <div className="grid h-full place-items-center p-8 text-center text-muted-foreground">{emptyText}</div>
                )}
                {children}
            </div>
            {scale > 1 && (
                <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); resetView(); }}
                    className="absolute right-2 top-2 z-40 rounded-md bg-background/90 px-2 py-1 text-xs font-bold shadow"
                >
                    {Math.round(scale * 100)}%
                </button>
            )}
        </div>
    );
}
