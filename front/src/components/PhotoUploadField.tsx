import { useState, type ChangeEvent } from "react";
import { mediaUrl } from "../lib/items-api";
import { uploadItemMedia } from "../lib/items-admin-api";

type PhotoUploadFieldProps = {
    value: string;
    onChange: (url: string) => void;
    label?: string;
};

export function PhotoUploadField({ value, onChange, label = "Фото" }: PhotoUploadFieldProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    async function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setUploading(true);
        setError("");
        try {
            const { url } = await uploadItemMedia("image", file);
            onChange(url);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Ошибка загрузки файла");
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="grid gap-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            {value && <img src={mediaUrl(value)} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFile} className="w-auto text-xs" />
            {uploading && <span className="text-xs text-muted-foreground">Загрузка…</span>}
            {error && <span className="text-xs text-destructive">{error}</span>}
            {value && (
                <button type="button" onClick={() => onChange("")} className="justify-self-start text-xs text-destructive">
                    Убрать
                </button>
            )}
        </div>
    );
}
