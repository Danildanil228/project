import { LayoutGrid, Rows3 } from "lucide-react";
import { useCallback, useState } from "react";

export type CatalogViewMode = "cards" | "rows";

const storageKey = "catalog-view";

function readStoredView(): CatalogViewMode {
    try {
        return localStorage.getItem(storageKey) === "rows" ? "rows" : "cards";
    } catch {
        return "cards";
    }
}

export function useCatalogView() {
    const [view, setViewState] = useState<CatalogViewMode>(readStoredView);
    const setView = useCallback((next: CatalogViewMode) => {
        setViewState(next);
        try {
            localStorage.setItem(storageKey, next);
        } catch {
            // The selected view still works for this page when storage is unavailable.
        }
    }, []);

    return [view, setView] as const;
}

type CatalogViewToggleProps = {
    value: CatalogViewMode;
    onChange: (value: CatalogViewMode) => void;
};

export function CatalogViewToggle({ value, onChange }: CatalogViewToggleProps) {
    return (
        <div className="inline-flex rounded-lg border border-border p-1" aria-label="Вид каталога">
            <button
                type="button"
                onClick={() => onChange("cards")}
                title="Карточками"
                aria-pressed={value === "cards"}
                className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${value === "cards" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
                <LayoutGrid size={15} /> Карточки
            </button>
            <button
                type="button"
                onClick={() => onChange("rows")}
                title="Строками"
                aria-pressed={value === "rows"}
                className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${value === "rows" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
                <Rows3 size={15} /> Строки
            </button>
        </div>
    );
}
