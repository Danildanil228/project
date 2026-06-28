import { ImageOff } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { Skeleton } from "./LoadingState";

type LoadingImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "className"> & {
    src: string;
    className?: string;
    imageClassName?: string;
};

export function LoadingImage({ src, alt, className = "", imageClassName = "object-cover", ...props }: LoadingImageProps) {
    const imageRef = useRef<HTMLImageElement>(null);
    const [result, setResult] = useState<{ src: string; status: "loaded" | "error" } | null>(null);
    const status = result?.src === src ? result.status : "loading";

    // Cached images can complete before a passive effect runs. Read the native image state
    // synchronously after React updates `src`, and keep the result tied to that exact URL.
    useLayoutEffect(() => {
        const image = imageRef.current;
        if (!image?.complete) return;
        setResult({ src, status: image.naturalWidth > 0 ? "loaded" : "error" });
    }, [src]);

    return (
        <span className={`relative block overflow-hidden bg-muted ${className}`} aria-busy={status === "loading" || undefined}>
            {status === "loading" && <Skeleton className="absolute inset-0 size-full rounded-none" />}
            {status === "error" && (
                <span className="absolute inset-0 grid place-items-center text-muted-foreground" title="Изображение не загрузилось">
                    <ImageOff size={18} aria-hidden="true" />
                </span>
            )}
            <img
                key={src}
                ref={imageRef}
                {...props}
                src={src}
                alt={alt}
                onLoad={(event) => {
                    setResult({ src, status: "loaded" });
                    props.onLoad?.(event);
                }}
                onError={(event) => {
                    setResult({ src, status: "error" });
                    props.onError?.(event);
                }}
                className={`h-full w-full transition-opacity duration-300 ${imageClassName} ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
            />
        </span>
    );
}
