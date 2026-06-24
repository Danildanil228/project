import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";

// File-only avatar picker. Posts the raw binary to /api/uploads/avatar; backend writes the file
// under /uploads/avatars/<uuid>.<ext>, deletes the previous file (if it was ours), and returns
// the public URL. Calls onChange with that URL — caller is responsible for persisting it via
// auth.api.updateUser.
type AvatarUploadFieldProps = {
    value: string;
    onChange: (url: string) => void;
};

const acceptedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function AvatarUploadField({ value, onChange }: AvatarUploadFieldProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!acceptedTypes.includes(file.type)) {
            setError("Поддерживаются PNG, JPEG, WEBP, GIF");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/uploads/avatar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": file.type },
                body: file,
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message || "Не удалось загрузить файл");
            }
            const data = await response.json() as { url: string };
            onChange(data.url);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Ошибка загрузки");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid gap-2 text-sm">
            <span className="text-muted-foreground">Аватар</span>
            <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary">
                    <Upload size={14} />
                    {value ? "Заменить файл" : "Выбрать файл"}
                    <input type="file" accept={acceptedTypes.join(",")} onChange={handleFile} disabled={busy} className="hidden" />
                </label>
                {value && (
                    <button type="button" onClick={() => onChange("")} className="text-xs text-destructive hover:underline">
                        Убрать
                    </button>
                )}
            </div>
            {busy && <span className="text-xs text-muted-foreground">Загрузка…</span>}
            {error && <span className="text-xs text-destructive">{error}</span>}
            <span className="text-xs text-muted-foreground">До 2 МБ. PNG, JPEG, WEBP или GIF.</span>
        </div>
    );
}
