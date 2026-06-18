import { useEffect, useMemo, useRef, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import type { ComboboxOption } from "./Combobox";

type MultiComboboxProps = {
    options: ComboboxOption[];
    selected: number[];
    onChange: (next: number[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
};

// Multi-select with checkbox-style behaviour: clicking an item toggles its membership,
// the trigger shows the selected items as removable chips.
export function MultiCombobox({
    options,
    selected,
    onChange,
    placeholder = "Добавить…",
    searchPlaceholder = "Поиск…",
    emptyMessage = "Ничего не найдено",
}: MultiComboboxProps) {
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

    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const selectedOptions = useMemo(() => options.filter((option) => selectedSet.has(option.id)), [options, selectedSet]);

    function toggle(id: number) {
        onChange(selectedSet.has(id) ? selected.filter((value) => value !== id) : [...selected, id]);
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Chips of currently selected items, with a "+ add" trigger at the end */}
            <div
                className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                onClick={() => setOpen(true)}
            >
                {selectedOptions.map((option) => (
                    <span key={option.id} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {option.name}
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                toggle(option.id);
                            }}
                            aria-label={`Убрать ${option.name}`}
                            className="opacity-60 hover:opacity-100"
                        >
                            ✕
                        </button>
                    </span>
                ))}
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        setOpen((value) => !value);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    {selectedOptions.length ? "+ Ещё" : placeholder}
                </button>
            </div>

            {open && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    <Command className="text-sm" filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
                        <CommandInput placeholder={searchPlaceholder} className="w-full border-b border-border bg-transparent px-3 py-2 outline-none" />
                        <CommandList className="max-h-60 overflow-y-auto py-1">
                            <CommandEmpty className="p-3 text-muted-foreground">{emptyMessage}</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => {
                                    const checked = selectedSet.has(option.id);
                                    return (
                                        <CommandItem
                                            key={option.id}
                                            value={option.name}
                                            onSelect={() => toggle(option.id)}
                                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted aria-selected:bg-muted"
                                        >
                                            <input
                                                type="checkbox"
                                                readOnly
                                                checked={checked}
                                                className="pointer-events-none shrink-0"
                                            />
                                            <span className={checked ? "font-bold" : ""}>{option.name}</span>
                                            {option.hint && <span className="ml-auto text-xs text-muted-foreground">{option.hint}</span>}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
            )}
        </div>
    );
}
