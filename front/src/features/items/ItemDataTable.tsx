import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { itemFields, type ItemFieldDef } from "../../lib/item-fields";
import { mediaUrl, type ItemType } from "../../lib/items-api";

type ItemRow = { id: number; name: string; photo?: string | null } & Record<string, unknown>;

type Props = {
    type: ItemType;
    rows: ItemRow[];
    loading: boolean;
    sortBy: string;
    sortDirection: "asc" | "desc";
    filters: Record<string, string>;
    onSort: (field: string) => void;
    onFilter: (field: string, value: string) => void;
};

function tableFields(type: ItemType) {
    const fields = itemFields[type].filter((field) => field.key !== "model");
    return [fields.find((field) => field.key === "photo"), fields.find((field) => field.key === "name"), ...fields.filter((field) => field.key !== "photo" && field.key !== "name")].filter(Boolean) as ItemFieldDef[];
}

function displayValue(field: ItemFieldDef, row: ItemRow, type: ItemType) {
    const value = row[field.key];
    if (field.key === "photo") {
        return row.photo
            ? <img src={mediaUrl(row.photo)} alt={row.name} title={row.name} className="h-12 w-16 object-contain" />
            : <span className="text-muted-foreground">—</span>;
    }
    if (field.key === "name") {
        return <Link to={`/catalog/${type}/${row.id}`} className="font-semibold text-foreground hover:text-primary">{row.name}</Link>;
    }
    if (typeof value === "boolean") return value ? "Да" : "Нет";
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
}

export function ItemDataTable({ type, rows, loading, sortBy, sortDirection, filters, onSort, onFilter }: Props) {
    const fields = tableFields(type);
    return (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-max w-full border-collapse text-sm">
                <thead className="bg-muted/40">
                    <tr className="border-b border-border text-left">
                        {fields.map((field) => {
                            const sortable = field.key !== "photo";
                            const active = sortBy === field.key;
                            return (
                                <th key={field.key} className={`whitespace-nowrap px-3 py-2 font-semibold ${field.key === "name" ? "sticky left-0 z-20 bg-muted" : ""}`}>
                                    {sortable ? (
                                        <button type="button" onClick={() => onSort(field.key)} className="inline-flex items-center gap-1 hover:text-primary" title={`Сортировать: ${field.label}`}>
                                            {field.label}
                                            {active ? (sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="text-muted-foreground" />}
                                        </button>
                                    ) : field.label}
                                </th>
                            );
                        })}
                        <th className="sticky right-0 z-20 bg-muted px-3 py-2 text-right">Открыть</th>
                    </tr>
                    <tr className="border-b border-border">
                        {fields.map((field) => (
                            <th key={field.key} className={`px-2 py-2 ${field.key === "name" ? "sticky left-0 z-20 bg-muted" : ""}`}>
                                {field.key === "photo" ? null : field.kind === "checkbox" ? (
                                    <select aria-label={`Фильтр: ${field.label}`} value={filters[field.key] ?? ""} onChange={(event) => onFilter(field.key, event.target.value)} className="h-8 min-w-24 text-xs">
                                        <option value="">Все</option><option value="true">Да</option><option value="false">Нет</option>
                                    </select>
                                ) : field.options ? (
                                    <select aria-label={`Фильтр: ${field.label}`} value={filters[field.key] ?? ""} onChange={(event) => onFilter(field.key, event.target.value)} className="h-8 min-w-32 text-xs">
                                        <option value="">Все</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                ) : (
                                    <input aria-label={`Фильтр: ${field.label}`} value={filters[field.key] ?? ""} onChange={(event) => onFilter(field.key, event.target.value)} placeholder="Фильтр" className="h-8 w-28 text-xs" />
                                )}
                            </th>
                        ))}
                        <th className="sticky right-0 z-20 bg-muted" />
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan={fields.length + 1} className="p-8 text-center text-muted-foreground">Загрузка…</td></tr>
                    ) : rows.length === 0 ? (
                        <tr><td colSpan={fields.length + 1} className="p-8 text-center text-muted-foreground">Ничего не найдено</td></tr>
                    ) : rows.map((row) => (
                        <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            {fields.map((field) => (
                                <td key={field.key} className={`max-w-56 whitespace-nowrap px-3 py-2 text-muted-foreground ${field.key === "name" ? "sticky left-0 z-10 bg-card text-foreground" : ""}`}>
                                    {displayValue(field, row, type)}
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 bg-card px-3 py-2 text-right">
                                <Link to={`/catalog/${type}/${row.id}`} title={`Открыть ${row.name}`} className="inline-grid size-8 place-items-center rounded-lg border border-border hover:border-primary hover:text-primary"><ExternalLink size={15} /></Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
