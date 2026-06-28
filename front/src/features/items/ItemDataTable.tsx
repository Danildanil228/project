import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
    type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { itemFields, type ItemFieldDef } from "../../lib/item-fields";
import { mediaUrl, type ItemType } from "../../lib/items-api";
import { LoadingImage } from "../../components/LoadingImage";
import { TableRowsSkeleton } from "../../components/LoadingState";

type ItemRow = { id: number; name: string; photo?: string | null } & Record<string, unknown>;

type Props = {
    type: ItemType;
    rows: ItemRow[];
    loading: boolean;
    sortBy: string;
    sortDirection: "asc" | "desc";
    onSort: (field: string) => void;
};

// Hand-picked default-visible columns for each type. Everything else hides behind the «Колонки» menu.
// Kept lean (6 cols) so the table fits a 1366px laptop without horizontal scroll.
const defaultVisibleColumns: Record<ItemType, string[]> = {
    reels: ["photo", "name", "category", "brend", "lvl", "price_ser"],
    rods: ["photo", "name", "category", "type", "lvl", "price_ser"],
};

// `model` is not user-displayed in the table; `name` and `photo` get bespoke renderers.
function tableFields(type: ItemType): ItemFieldDef[] {
    const fields = itemFields[type].filter((field) => field.key !== "model");
    const photo = fields.find((field) => field.key === "photo");
    const name = fields.find((field) => field.key === "name");
    const rest = fields.filter((field) => field.key !== "photo" && field.key !== "name");
    return [photo, name, ...rest].filter(Boolean) as ItemFieldDef[];
}

function renderCell(field: ItemFieldDef, row: ItemRow, type: ItemType) {
    const value = row[field.key];
    if (field.key === "photo") {
        return row.photo
            ? <LoadingImage src={mediaUrl(row.photo)} alt={row.name} title={row.name} className="h-10 w-14" imageClassName="object-contain" />
            : <span className="text-muted-foreground">—</span>;
    }
    if (field.key === "name") {
        return <Link to={`/catalog/${type}/${row.id}`} className="font-semibold text-foreground hover:text-primary">{row.name}</Link>;
    }
    if (typeof value === "boolean") return value ? "Да" : "Нет";
    if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
    return String(value);
}

function loadVisibility(type: ItemType, fields: ItemFieldDef[]): VisibilityState {
    const stored = localStorage.getItem(`catalog-cols-${type}`);
    if (stored) {
        try { return JSON.parse(stored) as VisibilityState; } catch { /* fall through to defaults */ }
    }
    const defaults = new Set(defaultVisibleColumns[type]);
    return Object.fromEntries(fields.map((field) => [field.key, defaults.has(field.key)]));
}

export function ItemDataTable({ type, rows, loading, sortBy, sortDirection, onSort }: Props) {
    const fields = useMemo(() => tableFields(type), [type]);
    const [visibility, setVisibility] = useState<VisibilityState>(() => loadVisibility(type, fields));
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Reset visibility map when the user switches between reels/rods (different default sets).
    useEffect(() => { setVisibility(loadVisibility(type, fields)); }, [type, fields]);

    // Persist per-type column choices so the user's selection survives reloads.
    useEffect(() => { localStorage.setItem(`catalog-cols-${type}`, JSON.stringify(visibility)); }, [type, visibility]);

    // Close the «Колонки» dropdown on outside click.
    useEffect(() => {
        if (!menuOpen) return;
        function onDown(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [menuOpen]);

    // Sort state mirrors server-driven sort; TanStack stays in lockstep with the URL/query state.
    const sorting: SortingState = useMemo(() => sortBy ? [{ id: sortBy, desc: sortDirection === "desc" }] : [], [sortBy, sortDirection]);

    const columns = useMemo<ColumnDef<ItemRow>[]>(() => {
        return fields.map((field) => ({
            id: field.key,
            accessorKey: field.key,
            header: field.shortLabel ?? field.label,
            enableSorting: field.key !== "photo",
            meta: { field },
            cell: ({ row }) => renderCell(field, row.original, type),
            size: field.key === "photo" ? 80 : field.key === "name" ? 220 : undefined,
        }));
    }, [fields, type]);

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting, columnVisibility: visibility },
        getCoreRowModel: getCoreRowModel(),
        onColumnVisibilityChange: setVisibility,
        manualSorting: true,
    });

    const visibleFields = fields.filter((field) => visibility[field.key] !== false);
    const visibleCount = visibleFields.length;
    const totalCount = fields.length;

    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    Видно <strong className="text-foreground">{visibleCount}</strong> из {totalCount} колонок · клик по заголовку — сортировка
                </p>
                <div ref={menuRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-primary"
                    >
                        <Settings2 size={14} /> Колонки
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 z-30 mt-1 grid max-h-96 w-64 gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg">
                            {fields.map((field) => {
                                // Native <label> + child <input> double-fires click events; use <button> instead.
                                const checked = visibility[field.key] !== false;
                                const lockedName = field.key === "name";
                                return (
                                    <button
                                        key={field.key}
                                        type="button"
                                        disabled={lockedName}
                                        onClick={() => {
                                            if (lockedName) return;
                                            setVisibility((current) => ({ ...current, [field.key]: !checked }));
                                        }}
                                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${lockedName ? "cursor-not-allowed opacity-60" : ""}`}
                                    >
                                        <input type="checkbox" checked={checked} readOnly className="pointer-events-none shrink-0" />
                                        <span>{field.label}</span>
                                    </button>
                                );
                            })}
                            <div className="mt-1 flex gap-1 border-t border-border pt-1">
                                <button
                                    type="button"
                                    onClick={() => setVisibility(Object.fromEntries(fields.map((field) => [field.key, true])))}
                                    className="flex-1 rounded px-2 py-1 text-xs hover:bg-muted"
                                >Все</button>
                                <button
                                    type="button"
                                    onClick={() => setVisibility(Object.fromEntries(fields.map((field) => [field.key, new Set(defaultVisibleColumns[type]).has(field.key)])))}
                                    className="flex-1 rounded px-2 py-1 text-xs hover:bg-muted"
                                >По умолчанию</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted/40">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="border-b border-border text-left">
                                {headerGroup.headers.map((header) => {
                                    const field = (header.column.columnDef.meta as { field: ItemFieldDef }).field;
                                    const sortable = header.column.getCanSort();
                                    const active = sortBy === field.key;
                                    const isName = field.key === "name";
                                    const label = field.shortLabel ?? field.label;
                                    return (
                                        <th key={header.id} className={`whitespace-nowrap px-3 py-2 font-semibold ${isName ? "sticky left-0 z-20 bg-muted" : ""}`}>
                                            {sortable ? (
                                                <button type="button" onClick={() => onSort(field.key)} className="inline-flex items-center gap-1 hover:text-primary" title={`Сортировать: ${field.label}`}>
                                                    {label}
                                                    {active ? (sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="text-muted-foreground" />}
                                                </button>
                                            ) : label}
                                        </th>
                                    );
                                })}
                                <th className="sticky right-0 z-20 bg-muted px-3 py-2 text-right">Открыть</th>
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableRowsSkeleton columns={visibleCount + 1} rows={7} />
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={visibleCount + 1} className="p-8 text-center text-muted-foreground">Ничего не найдено</td></tr>
                        ) : table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                                {row.getVisibleCells().map((cell) => {
                                    const field = (cell.column.columnDef.meta as { field: ItemFieldDef }).field;
                                    const isName = field.key === "name";
                                    return (
                                        <td key={cell.id} className={`max-w-56 px-3 py-2 align-top text-muted-foreground ${isName ? "sticky left-0 z-10 bg-card text-foreground" : ""}`}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    );
                                })}
                                <td className="sticky right-0 z-10 bg-card px-3 py-2 text-right">
                                    <Link to={`/catalog/${type}/${row.original.id}`} title={`Открыть ${row.original.name}`} className="inline-grid size-8 place-items-center rounded-lg border border-border hover:border-primary hover:text-primary"><ExternalLink size={15} /></Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
