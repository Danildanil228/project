import { useState, type FormEvent } from "react";
import { itemFields } from "../../lib/item-fields";
import type { ItemType } from "../../lib/items-api";

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

    function setField(key: string, value: string | boolean) {
        setValues((previous) => ({ ...previous, [key]: value }));
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        onSubmit(values);
    }

    return (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {itemFields[type].map((field) => (
                    <label key={field.key} className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">
                            {field.label}
                            {field.required && " *"}
                        </span>
                        {field.kind === "select" ? (
                            <select
                                value={values[field.key] as string}
                                onChange={(event) => setField(field.key, event.target.value)}
                                required={field.required}
                            >
                                <option value="">—</option>
                                {field.options?.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
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
