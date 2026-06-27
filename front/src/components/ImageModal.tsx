import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from "lucide-react";
import { mediaUrl } from "../lib/items-api";

type ImageModalProps = {
    urls: string[];
    index: number;
    onClose: () => void;
    onNavigate: (next: number) => void;
};

type ViewState = { scale: number; x: number; y: number };

const minScale = 1;
const maxScale = 5;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Full-screen photo viewer with mouse zoom, drag, keyboard navigation and mobile pinch/swipe. */
export function ImageModal({ urls, index, onClose, onNavigate }: ImageModalProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const pointersRef = useRef(new Map<number, { x: number; y: number }>());
    const pinchRef = useRef<{ distance: number; scale: number; contentX: number; contentY: number } | null>(null);
    const swipeRef = useRef<{ x: number; y: number } | null>(null);
    const movedRef = useRef(false);
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
        const limitX = rect.width * (next.scale - 1) / 2;
        const limitY = rect.height * (next.scale - 1) / 2;
        return {
            scale: next.scale,
            x: clamp(next.x, -limitX, limitX),
            y: clamp(next.y, -limitY, limitY),
        };
    }, []);

    const zoomAt = useCallback((requestedScale: number, clientX?: number, clientY?: number) => {
        const rect = stageRef.current?.getBoundingClientRect();
        if (!rect) return;
        setView((current) => {
            const nextScale = clamp(Number(requestedScale.toFixed(2)), minScale, maxScale);
            const localX = (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
            const localY = (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
            const contentX = (localX - current.x) / current.scale;
            const contentY = (localY - current.y) / current.scale;
            return clampView({
                scale: nextScale,
                x: localX - contentX * nextScale,
                y: localY - contentY * nextScale,
            }, rect);
        });
    }, [clampView, setView]);

    const resetView = useCallback(() => {
        setView(() => ({ scale: 1, x: 0, y: 0 }));
    }, [setView]);

    useEffect(() => {
        resetView();
    }, [index, resetView]);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
            if (event.key === "ArrowRight" && index < urls.length - 1) onNavigate(index + 1);
        }
        document.addEventListener("keydown", onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [index, urls.length, onClose, onNavigate]);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            zoomAt(viewRef.current.scale + (event.deltaY > 0 ? -0.25 : 0.25), event.clientX, event.clientY);
        };
        stage.addEventListener("wheel", onWheel, { passive: false });
        return () => stage.removeEventListener("wheel", onWheel);
    }, [zoomAt]);

    if (!urls.length) return null;
    const url = urls[Math.max(0, Math.min(index, urls.length - 1))];

    function startPinch() {
        const rect = stageRef.current?.getBoundingClientRect();
        const points = [...pointersRef.current.values()];
        if (!rect || points.length < 2) return;
        const center = midpoint(points[0], points[1]);
        const current = viewRef.current;
        pinchRef.current = {
            distance: Math.max(distance(points[0], points[1]), 1),
            scale: current.scale,
            contentX: (center.x - rect.left - rect.width / 2 - current.x) / current.scale,
            contentY: (center.y - rect.top - rect.height / 2 - current.y) / current.scale,
        };
    }

    function handlePointerDown(event: PointerEvent<HTMLImageElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        movedRef.current = false;
        swipeRef.current = { x: event.clientX, y: event.clientY };
        if (pointersRef.current.size >= 2) {
            startPinch();
        }
    }

    function handlePointerMove(event: PointerEvent<HTMLImageElement>) {
        if (!pointersRef.current.has(event.pointerId)) return;
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const rect = stageRef.current?.getBoundingClientRect();
        const points = [...pointersRef.current.values()];
        if (!rect) return;

        if (points.length >= 2 && pinchRef.current) {
            event.preventDefault();
            const center = midpoint(points[0], points[1]);
            const pinch = pinchRef.current;
            const nextScale = clamp(pinch.scale * distance(points[0], points[1]) / pinch.distance, minScale, maxScale);
            setView(() => clampView({
                scale: nextScale,
                x: center.x - rect.left - rect.width / 2 - pinch.contentX * nextScale,
                y: center.y - rect.top - rect.height / 2 - pinch.contentY * nextScale,
            }, rect));
            movedRef.current = true;
        } else if (swipeRef.current && (Math.abs(event.clientX - swipeRef.current.x) > 6 || Math.abs(event.clientY - swipeRef.current.y) > 6)) {
            movedRef.current = true;
        }
    }

    function handlePointerUp(event: PointerEvent<HTMLImageElement>) {
        const swipe = swipeRef.current;
        const wasSinglePointer = pointersRef.current.size === 1;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        pointersRef.current.delete(event.pointerId);

        if (wasSinglePointer && viewRef.current.scale === 1 && swipe) {
            const dx = event.clientX - swipe.x;
            const dy = event.clientY - swipe.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0 && index < urls.length - 1) onNavigate(index + 1);
                if (dx > 0 && index > 0) onNavigate(index - 1);
            }
        }

        pinchRef.current = null;
        swipeRef.current = null;
        const remaining = [...pointersRef.current.values()];
        if (remaining.length >= 2) startPinch();
    }

    return (
        <div className="fixed inset-0 z-50 bg-black" role="dialog" aria-modal="true" aria-label="Просмотр фотографий">
            <div ref={stageRef} className="absolute inset-0 touch-none overflow-hidden" onClick={onClose}>
                <img
                    src={mediaUrl(url)}
                    alt={`Фото ${index + 1} из ${urls.length}`}
                    draggable={false}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (movedRef.current) {
                            movedRef.current = false;
                            return;
                        }
                        zoomAt(viewRef.current.scale === 1 ? 2 : 1, event.clientX, event.clientY);
                    }}
                    className={`absolute inset-0 m-auto max-h-full max-w-full select-none object-contain ${view.scale > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                    style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "center" }}
                />
            </div>

            <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border border-white/15 bg-black/65 p-1 text-white backdrop-blur-sm">
                <button type="button" onClick={() => zoomAt(viewRef.current.scale - 0.25)} disabled={view.scale <= minScale} aria-label="Уменьшить" title="Уменьшить" className="grid size-9 place-items-center disabled:opacity-40"><Minus size={18} /></button>
                <button type="button" onClick={resetView} disabled={view.scale === 1} title="Сбросить масштаб" className="flex h-9 min-w-16 items-center justify-center gap-1 border-x border-white/15 px-2 text-xs font-bold disabled:opacity-60"><RotateCcw size={15} /> {Math.round(view.scale * 100)}%</button>
                <button type="button" onClick={() => zoomAt(viewRef.current.scale + 0.25)} disabled={view.scale >= maxScale} aria-label="Увеличить" title="Увеличить" className="grid size-9 place-items-center disabled:opacity-40"><Plus size={18} /></button>
            </div>

            <button type="button" onClick={onClose} aria-label="Закрыть" title="Закрыть" className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-md border border-white/15 bg-black/65 text-white backdrop-blur-sm hover:bg-white/15"><X size={24} /></button>

            {index > 0 && (
                <button type="button" onClick={() => onNavigate(index - 1)} aria-label="Предыдущее фото" className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-md bg-black/65 text-white hover:bg-white/15"><ChevronLeft size={28} /></button>
            )}
            {index < urls.length - 1 && (
                <button type="button" onClick={() => onNavigate(index + 1)} aria-label="Следующее фото" className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-md bg-black/65 text-white hover:bg-white/15"><ChevronRight size={28} /></button>
            )}

            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-black/65 px-3 py-1.5 text-sm font-bold text-white">
                {index + 1} / {urls.length}
            </div>
        </div>
    );
}
