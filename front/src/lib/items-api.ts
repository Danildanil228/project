import type { Reel } from "../types/reel";
import type { Rod } from "../types/rod";

export type ItemType = "reels" | "rods";
export type ItemOf<T extends ItemType> = T extends "reels" ? Reel : Rod;

// Fields shared by every item type — enough to render a catalog card.
export type CatalogItem = {
    id: number;
    name: string;
    category: string;
    brend: string;
    lvl: number | null;
    price_ser: string | null;
    photo: string | null;
};

export type ItemListParams = {
    search?: string;
    category?: string;
    brend?: string;
    type?: string;
    minLvl?: number;
    maxLvl?: number;
    filters?: Record<string, string>;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    limit?: number;
    offset?: number;
};

export type ItemListResponse<T> = {
    items: T[];
    total: number;
    limit: number;
    offset: number;
};

export const typeLabels: Record<ItemType, string> = {
    reels: "Катушки",
    rods: "Удилища",
};

export const itemCategories: Record<ItemType, string[]> = {
    reels: ["Безинерционные", "Байткастинговые", "Силовые", "Низкопрофильные"],
    rods: ["Спиннинговые", "Доночные", "Поплавочные", "Морские"],
};

async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.message || `Запрос не выполнен (${response.status})`;
}

const localMediaHosts = new Set(["localhost", "127.0.0.1", "::1"]);

// Resolves stored media to a usable src and repairs legacy URLs that pointed at the uploader's localhost.
export function mediaUrl(value?: string | null) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) {
        try {
            const parsed = new URL(value);
            if (localMediaHosts.has(parsed.hostname) && parsed.pathname.startsWith("/uploads/")) {
                return `${parsed.pathname}${parsed.search}${parsed.hash}`;
            }
        } catch {
            return value;
        }
        return value;
    }
    return `/${value.replace(/^\/+/, "")}`;
}

function buildQuery(params: ItemListParams) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
            query.set(key, key === "filters" ? JSON.stringify(value) : String(value));
        }
    }
    return query.toString();
}

export async function fetchItems<T extends ItemType>(type: T, params: ItemListParams = {}): Promise<ItemListResponse<ItemOf<T>>> {
    const response = await fetch(`/api/${type}?${buildQuery(params)}`);
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    return response.json();
}

export async function fetchItem<T extends ItemType>(type: T, id: number): Promise<{ item: ItemOf<T> }> {
    const response = await fetch(`/api/${type}/${id}`);
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    return response.json();
}
