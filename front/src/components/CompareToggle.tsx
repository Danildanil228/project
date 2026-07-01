import { useComparison } from "../context/ComparisonContext";
import type { CatalogItem, ItemType } from "../lib/items-api";

type Props = {
    type: ItemType;
    item: CatalogItem;
    compact?: boolean;
};

export function CompareToggle({ type, item, compact = false }: Props) {
    const comparison = useComparison();
    const checked = comparison.includes(type, item.id);

    return (
        <label
            className={`group inline-flex h-8 cursor-pointer items-center overflow-hidden text-foreground transition-all ${compact ? "w-8 justify-center border-0 bg-transparent p-0 shadow-none" : "w-8 gap-2 rounded-md border bg-card px-[7px] shadow-sm hover:w-[92px] hover:border-primary"}`}
            title={checked ? "Убрать из сравнения" : "Добавить в сравнение"}
            onClick={(event) => event.stopPropagation()}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={() => comparison.toggle(type, item.id, item.name)}
                className="size-4 shrink-0 accent-[var(--primary)]"
                aria-label={`${checked ? "Убрать из сравнения" : "Добавить в сравнение"}: ${item.name}`}
            />
            {!compact && <span className="whitespace-nowrap text-xs font-bold opacity-0 transition-opacity duration-150 group-hover:opacity-100">Сравнить</span>}
        </label>
    );
}
