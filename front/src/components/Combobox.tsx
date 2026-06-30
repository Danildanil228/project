import { useEffect, useMemo, useRef, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";

export type ComboboxOption = { id: number; name: string; hint?: string };

type ComboboxProps = {
    options: ComboboxOption[];
    value: number | null;
    onChange: (id: number | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
};

// Searchable single-select dropdown built on cmdk. Keyboard-friendly out of the box.
export function Combobox({ options, value, onChange, placeholder = "Выберите…", searchPlaceholder = "Поиск…", emptyMessage = "Ничего не найдено" }: ComboboxProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onPointer(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onPointer);
        return () => document.removeEventListener("mousedown", onPointer);
    }, [open]);

    const selected = useMemo(() => options.find((option) => option.id === value), [options, value]);

    function choose(next: number | null) {
        setOpen(false);
        onChange(next);
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm"
            >
                <span className={selected ? "" : "text-muted-foreground"}>{selected ? selected.name : placeholder}</span>
                <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
            </button>

            {open && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    <Command className="text-sm" filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
                        <CommandInput placeholder={searchPlaceholder} className="w-full border-b border-border bg-transparent px-3 py-2 outline-none" />
                        <CommandList className="max-h-60 overflow-y-auto py-1">
                            <CommandEmpty className="p-3 text-muted-foreground">{emptyMessage}</CommandEmpty>
                            <CommandGroup>
                                {value !== null && (
                                    <CommandItem
                                        value="__clear__"
                                        onSelect={() => choose(null)}
                                        className="cursor-pointer px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted aria-selected:bg-muted"
                                    >
                                        ✕ Очистить
                                    </CommandItem>
                                )}
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.id}
                                        value={option.name}
                                        onSelect={() => choose(option.id)}
                                        className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted aria-selected:bg-muted ${
                                            option.id === value ? "font-bold" : ""
                                        }`}
                                    >
                                        <span>{option.name}</span>
                                        {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
            )}
        </div>
    );
}
