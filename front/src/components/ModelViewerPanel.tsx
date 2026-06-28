import "@google/model-viewer";
import type { ModelViewerElement } from "@google/model-viewer";
import { Box, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../lib/items-api";
import { LoadingSpinner, Skeleton } from "./LoadingState";

type ModelViewerPanelProps = {
    src: string;
    alt: string;
    poster?: string | null;
};

export function ModelViewerPanel({ src, alt, poster }: ModelViewerPanelProps) {
    const viewerRef = useRef<ModelViewerElement>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        setStatus("loading");
        setProgress(0);
        const onProgress = (event: Event) => {
            const value = (event as CustomEvent<{ totalProgress?: number }>).detail?.totalProgress ?? 0;
            setProgress(Math.min(100, Math.max(0, Math.round(value * 100))));
        };
        const onLoad = () => {
            setProgress(100);
            setStatus("ready");
        };
        const onError = () => setStatus("error");

        viewer.addEventListener("progress", onProgress);
        viewer.addEventListener("load", onLoad);
        viewer.addEventListener("error", onError);
        return () => {
            viewer.removeEventListener("progress", onProgress);
            viewer.removeEventListener("load", onLoad);
            viewer.removeEventListener("error", onError);
        };
    }, [src, attempt]);

    return (
        <div className="relative h-[360px] overflow-hidden bg-muted" aria-busy={status === "loading" || undefined}>
            <model-viewer
                key={attempt}
                ref={viewerRef}
                src={mediaUrl(src)}
                alt={alt}
                poster={poster ? mediaUrl(poster) : undefined}
                camera-controls
                auto-rotate
                loading="eager"
                reveal="auto"
                shadow-intensity="0"
                environment-image="neutral"
                style={{ width: "100%", height: "360px" }}
            />

            {status === "loading" && (
                <div className="absolute inset-0 grid content-center justify-items-center gap-4 bg-background/90 px-6">
                    <Skeleton className="absolute inset-0 size-full rounded-none opacity-70" />
                    <div className="relative grid justify-items-center gap-3">
                        <span className="relative grid size-14 place-items-center rounded-full border border-border bg-card shadow-sm">
                            <Box size={24} className="text-primary" aria-hidden="true" />
                            <LoadingSpinner size={16} className="absolute -bottom-1 -right-1 size-6 rounded-full bg-card" />
                        </span>
                        <div className="grid w-56 max-w-full gap-2 text-center">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span>Загрузка 3D-модели</span>
                                <span className="tabular-nums text-muted-foreground">{progress}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Загрузка 3D-модели" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                                <span className="block h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(progress, 4)}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="absolute inset-0 grid place-items-center bg-background/90 p-6 text-center">
                    <div className="grid justify-items-center gap-3">
                        <Box size={30} className="text-muted-foreground" aria-hidden="true" />
                        <div><strong className="text-sm">Модель не загрузилась</strong><p className="text-xs text-muted-foreground">Проверьте соединение и повторите попытку.</p></div>
                        <button type="button" onClick={() => setAttempt((value) => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:border-primary">
                            <RefreshCw size={14} /> Повторить
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
