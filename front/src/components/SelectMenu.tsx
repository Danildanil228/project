import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type SelectOption = {
    value: string;
    label: string;
    hint?: string;
};

type SelectMenuProps = {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
};

export function SelectMenu({ value, options, onChange, placeholder = "Выберите...", disabled, className = "" }: SelectMenuProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

    useEffect(() => {
        if (!open) return;
        function close(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    function choose(next: string) {
        onChange(next);
        setOpen(false);
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((current) => !current)}
                className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm font-semibold shadow-sm transition-colors ${
                    open ? "border-primary ring-2 ring-ring" : "border-border hover:border-primary/60"
                } disabled:opacity-50`}
            >
                <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected?.label ?? placeholder}</span>
                <span className="flex h-5 items-center border-l border-border pl-3 text-muted-foreground">
                    <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full min-w-44 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                    <div className="max-h-72 overflow-y-auto py-1">
                        {options.map((option) => {
                            const active = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => choose(option.value)}
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                        active ? "bg-primary/15 text-foreground" : "hover:bg-muted"
                                    }`}
                                >
                                    <span className="grid size-4 shrink-0 place-items-center">
                                        {active && <Check size={14} />}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-semibold">{option.label}</span>
                                    {option.hint && <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
