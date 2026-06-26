import { useState, type ChangeEvent, type FormEvent } from "react";
import { itemFields, type ItemFieldDef } from "../../lib/item-fields";
import { mediaUrl, type ItemType } from "../../lib/items-api";
import { uploadItemMedia } from "../../lib/items-admin-api";
import { SelectMenu } from "../../components/SelectMenu";

type ItemFormProps = {
    type: ItemType;
    initial?: Record<string, unknown> | null;
    submitting: boolean;
    error?: string;
    onSubmit: (data: Record<string, unknown>) => void;
    onCancel: () => void;
};

function buildInitialValues(type: ItemType, initial?: Record<string, unknown> | null) {
    const values: Record<string, string | boolean> = {};
    for (const field of itemFields[type]) {
        const raw = initial?.[field.key];
        if (field.kind === "checkbox") {
            values[field.key] = Boolean(raw);
        } else {
            values[field.key] = raw === null || raw === undefined ? "" : String(raw);
        }
    }
    return values;
}

export function ItemForm({ type, initial, submitting, error, onSubmit, onCancel }: ItemFormProps) {
    const [values, setValues] = useState<Record<string, string | boolean>>(() => buildInitialValues(type, initial));
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState("");

    function setField(key: string, value: string | boolean) {
        setValues((previous) => ({ ...previous, [key]: value }));
    }

    async function handleFile(field: ItemFieldDef, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !field.mediaKind) return;

        setUploadingKey(field.key);
        setUploadError("");
        try {
            const { url } = await uploadItemMedia(field.mediaKind, file);
            setField(field.key, url);
        } catch (caught) {
            setUploadError(caught instanceof Error ? caught.message : "Ошибка загрузки файла");
        } finally {
            setUploadingKey(null);
        }
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        onSubmit(values);
    }

    return (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
            {(error || uploadError) && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error || uploadError}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {itemFields[type].map((field) => (
                    <label key={field.key} className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">
                            {field.label}
                            {field.required && " *"}
                        </span>
                        {field.kind === "select" ? (
                            <SelectMenu
                                value={values[field.key] as string}
                                onChange={(value) => setField(field.key, value)}
                                options={[{ value: "", label: "—" }, ...(field.options ?? []).map((option) => ({ value: option, label: option }))]}
                            />
                        ) : field.kind === "checkbox" ? (
                            <span className="flex h-[42px] items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="size-4 w-auto"
                                    checked={values[field.key] as boolean}
                                    onChange={(event) => setField(field.key, event.target.checked)}
                                />
                                <span>{(values[field.key] as boolean) ? "Да" : "Нет"}</span>
                            </span>
                        ) : field.kind === "file" ? (
                            <div className="grid gap-2">
                                {values[field.key] && field.mediaKind === "image" && (
                                    <img src={mediaUrl(values[field.key] as string)} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
                                )}
                                {values[field.key] && field.mediaKind === "model" && (
                                    <a href={mediaUrl(values[field.key] as string)} target="_blank" rel="noreferrer" className="truncate text-xs text-primary">
                                        Текущий файл загружен
                                    </a>
                                )}
                                <input type="file" accept={field.accept} onChange={(event) => handleFile(field, event)} className="w-auto text-xs" />
                                {uploadingKey === field.key && <span className="text-xs text-muted-foreground">Загрузка…</span>}
                                {values[field.key] && (
                                    <button type="button" onClick={() => setField(field.key, "")} className="justify-self-start text-xs text-destructive">
                                        Убрать
                                    </button>
                                )}
                            </div>
                        ) : (
                            <input
                                type={field.kind === "number" ? "number" : "text"}
                                value={values[field.key] as string}
                                onChange={(event) => setField(field.key, event.target.value)}
                                required={field.required}
                            />
                        )}
                    </label>
                ))}
            </div>

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                    {submitting ? "Сохранение…" : "Сохранить"}
                </button>
                <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">
                    Отмена
                </button>
            </div>
        </form>
    );
}
