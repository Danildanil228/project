import type { Fish, FishInput } from "../types/fish";
import type { Waterbody, WaterbodyListRow } from "../types/waterbody";
import type { Bait, BaitCatalogMeta, BaitDomain, BaitInput } from "../types/bait";
import type { FishingSpot, SpotInput } from "../types/spot";

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

function listQuery(params: { search?: string; rarity?: string; waterbodyId?: number; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.rarity) query.set("rarity", params.rarity);
    if (params.waterbodyId) query.set("waterbodyId", String(params.waterbodyId));
    query.set("limit", String(params.limit ?? 200));
    if (params.offset) query.set("offset", String(params.offset));
    return query.toString();
}

// Fish
export function listFish(params?: { search?: string; rarity?: string; waterbodyId?: number; limit?: number; offset?: number }) {
    return requestJson<ListResponse<Fish>>(`/api/fish?${listQuery(params)}`);
}
export function createFish(data: FishInput) {
    return requestJson<{ item: Fish; id: number; alreadyExisted: boolean; habitatsAdded: number }>(`/api/fish`, withBody("POST", data));
}
export function createFishBulk(items: FishInput[]) {
    return requestJson<{ items: Fish[]; created: number; existing: number; habitatsAdded: number }>(`/api/fish/bulk`, withBody("POST", { items }));
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
export function createWaterbody(data: {
    name: string;
    photo: string | null;
    coordinateMinX: number | null;
    coordinateMinY: number | null;
    coordinateMaxX: number | null;
    coordinateMaxY: number | null;
    fishIds: number[];
}) {
    return requestJson<{ item: Waterbody }>(`/api/waterbodies`, withBody("POST", data));
}
export function updateWaterbody(id: number, data: Record<string, unknown>) {
    return requestJson<{ item: Waterbody }>(`/api/waterbodies/${id}`, withBody("PATCH", data));
}
export function deleteWaterbody(id: number) {
    return requestJson<{ deleted: { id: number; name: string } }>(`/api/waterbodies/${id}`, { method: "DELETE" });
}

// Baits and lures
export function listBaits(params: { search?: string; domain?: BaitDomain | ""; categoryCode?: string; familyId?: number | null; includeInactive?: boolean; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.domain) query.set("domain", params.domain);
    if (params.categoryCode) query.set("categoryCode", params.categoryCode);
    if (params.familyId) query.set("familyId", String(params.familyId));
    if (params.includeInactive) query.set("includeInactive", "true");
    query.set("limit", String(params.limit ?? 200));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<ListResponse<Bait>>(`/api/baits?${query}`);
}

export async function listAllBaits(params: Omit<Parameters<typeof listBaits>[0], "limit" | "offset"> = {}) {
    const limit = 500;
    const first = await listBaits({ ...params, limit, offset: 0 });
    const items = [...first.items];
    let offset = first.items.length;

    while (items.length < first.total && offset > 0) {
        const response = await listBaits({ ...params, limit, offset });
        items.push(...response.items);
        if (response.items.length === 0) break;
        offset += response.items.length;
    }

    return { items, total: first.total, limit: items.length, offset: 0 };
}

export function getBaitCatalogMeta() {
    return requestJson<BaitCatalogMeta>(`/api/baits/meta`);
}

export function createBait(data: BaitInput) {
    return requestJson<{ item: Bait }>(`/api/baits`, withBody("POST", data));
}

export function updateBait(id: number, data: Record<string, unknown>) {
    return requestJson<{ item: Bait }>(`/api/baits/${id}`, withBody("PATCH", data));
}

export function deleteBait(id: number) {
    return requestJson<{ deleted: { id: number; name: string } }>(`/api/baits/${id}`, { method: "DELETE" });
}

// Fishing spots
export function listSpots(waterbodyId: number, includeInactive = false) {
    const query = new URLSearchParams({ waterbodyId: String(waterbodyId) });
    if (includeInactive) query.set("includeInactive", "true");
    return requestJson<{ items: FishingSpot[] }>(`/api/spots?${query}`);
}

export function createSpot(data: SpotInput) {
    return requestJson<{ item: FishingSpot }>(`/api/spots`, withBody("POST", data));
}

export function updateSpot(id: number, data: Omit<SpotInput, "waterbodyId">) {
    return requestJson<{ item: FishingSpot }>(`/api/spots/${id}`, withBody("PATCH", data));
}

export function addSpotVariants(id: number, variants: SpotInput["variants"]) {
    return requestJson<{ item: FishingSpot }>(`/api/spots/${id}/variants`, withBody("POST", { variants }));
}

export function deleteSpot(id: number) {
    return requestJson<{ deleted: { id: number; name: string; waterbodyId: number } }>(`/api/spots/${id}`, { method: "DELETE" });
}
