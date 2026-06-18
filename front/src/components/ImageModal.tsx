import { useEffect } from "react";
import { mediaUrl } from "../lib/items-api";

type ImageModalProps = {
    urls: string[];
    index: number;
    onClose: () => void;
    onNavigate: (next: number) => void;
};

// Full-screen lightbox for post photos. Keyboard: Esc closes, ← / → navigate.
export function ImageModal({ urls, index, onClose, onNavigate }: ImageModalProps) {
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
            if (event.key === "ArrowRight" && index < urls.length - 1) onNavigate(index + 1);
        }
        document.addEventListener("keydown", onKey);
        // Lock body scroll while open.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [index, urls.length, onClose, onNavigate]);

    if (!urls.length) return null;
    const url = urls[Math.max(0, Math.min(index, urls.length - 1))];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
                aria-label="Закрыть"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            >
                ✕
            </button>

            {index > 0 && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onNavigate(index - 1);
                    }}
                    aria-label="Назад"
                    className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
                >
                    ‹
                </button>
            )}

            <img
                src={mediaUrl(url)}
                alt=""
                onClick={(event) => event.stopPropagation()}
                className="max-h-[90vh] max-w-[92vw] cursor-default rounded-lg object-contain"
            />

            {index < urls.length - 1 && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onNavigate(index + 1);
                    }}
                    aria-label="Вперёд"
                    className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
                >
                    ›
                </button>
            )}

            {urls.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                    {index + 1} / {urls.length}
                </div>
            )}
        </div>
    );
}
