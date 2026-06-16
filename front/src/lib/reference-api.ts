import type { Fish } from "../types/fish";
import type { Waterbody, WaterbodyListRow } from "../types/waterbody";

type ListResponse<T> = { items: T[]; total: number; limit: number; offset: number };

async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.message || `Запрос не выполнен (${response.status})`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { credentials: "include", ...init });
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    return response.json();
}

function withBody(method: string, body: unknown): RequestInit {
    return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function listQuery(params: { search?: string; rarity?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.rarity) query.set("rarity", params.rarity);
    query.set("limit", String(params.limit ?? 200));
    return query.toString();
}

// Fish
export function listFish(params?: { search?: string; rarity?: string; limit?: number }) {
    return requestJson<ListResponse<Fish>>(`/api/fish?${listQuery(params)}`);
}
export function createFish(data: { name: string; rarity: string; photo: string | null }) {
    return requestJson<{ item: Fish }>(`/api/fish`, withBody("POST", data));
}
export function updateFish(id: number, data: Record<string, unknown>) {
    return requestJson<{ item: Fish }>(`/api/fish/${id}`, withBody("PATCH", data));
}
export function deleteFish(id: number) {
    return requestJson<{ deleted: { id: number; name: string } }>(`/api/fish/${id}`, { method: "DELETE" });
}

// Waterbodies
export function listWaterbodies(params?: { search?: string; limit?: number }) {
    return requestJson<ListResponse<WaterbodyListRow>>(`/api/waterbodies?${listQuery(params)}`);
}
export function getWaterbody(id: number) {
    return requestJson<{ item: Waterbody }>(`/api/waterbodies/${id}`);
}
export function createWaterbody(data: { name: string; photo: string | null; fishIds: number[] }) {
    return requestJson<{ item: Waterbody }>(`/api/waterbodies`, withBody("POST", data));
}
export function updateWaterbody(id: number, data: Record<string, unknown>) {
    return requestJson<{ item: Waterbody }>(`/api/waterbodies/${id}`, withBody("PATCH", data));
}
export function deleteWaterbody(id: number) {
    return requestJson<{ deleted: { id: number; name: string } }>(`/api/waterbodies/${id}`, { method: "DELETE" });
}
