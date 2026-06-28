import { ImageOff } from "lucide-react";
import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { Skeleton } from "./LoadingState";

type LoadingImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "className"> & {
    src: string;
    className?: string;
    imageClassName?: string;
};

export function LoadingImage({ src, alt, className = "", imageClassName = "object-cover", ...props }: LoadingImageProps) {
    const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

    useEffect(() => setStatus("loading"), [src]);

    return (
        <span className={`relative block overflow-hidden bg-muted ${className}`} aria-busy={status === "loading" || undefined}>
            {status === "loading" && <Skeleton className="absolute inset-0 size-full rounded-none" />}
            {status === "error" && (
                <span className="absolute inset-0 grid place-items-center text-muted-foreground" title="Изображение не загрузилось">
                    <ImageOff size={18} aria-hidden="true" />
                </span>
            )}
            <img
                {...props}
                src={src}
                alt={alt}
                onLoad={(event) => {
                    setStatus("loaded");
                    props.onLoad?.(event);
                }}
                onError={(event) => {
                    setStatus("error");
                    props.onError?.(event);
                }}
                className={`h-full w-full transition-opacity duration-300 ${imageClassName} ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
            />
        </span>
    );
}
