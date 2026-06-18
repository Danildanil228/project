import { useEffect, useMemo, useRef, useState } from "react";

export type MultiSelectOption = { id: number; name: string; hint?: string };

type MultiSelectFilterProps = {
    label: string;
    options: MultiSelectOption[];
    selected: number[];
    onChange: (next: number[]) => void;
    searchPlaceholder?: string;
};

export function MultiSelectFilter({ label, options, selected, onChange, searchPlaceholder = "Поиск…" }: MultiSelectFilterProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;
        return options.filter((option) => option.name.toLowerCase().includes(query));
    }, [options, search]);

    function toggle(id: number) {
        onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
    }

    return (
        <div ref={containerRef} className="relative text-sm">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left"
            >
                <span>
                    {label}
                    {selected.length > 0 && <span className="ml-1 rounded bg-primary px-1.5 text-xs font-bold text-primary-foreground">{selected.length}</span>}
                </span>
                <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
            </button>

            {open && (
                <div className="absolute z-20 mt-1 w-full min-w-56 rounded-lg border border-border bg-card p-2 shadow-lg">
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className="mb-2" />
                    <div className="max-h-60 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="px-2 py-3 text-muted-foreground">Ничего не найдено</p>
                        ) : (
                            filtered.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => toggle(option.id)}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                                >
                                    <input type="checkbox" readOnly checked={selected.includes(option.id)} className="pointer-events-none shrink-0" />
                                    <span className="font-medium">{option.name}</span>
                                    {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
                                </div>
                            ))
                        )}
                    </div>
                    {selected.length > 0 && (
                        <button type="button" onClick={() => onChange([])} className="mt-2 w-full rounded-lg border border-border px-2 py-1.5 text-xs font-bold hover:border-primary">
                            Сбросить ({selected.length})
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
