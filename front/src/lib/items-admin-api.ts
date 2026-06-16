import type { ItemType } from "./items-api";

async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.message || `Запрос не выполнен (${response.status})`;
}

export async function createItemRequest(type: ItemType, data: Record<string, unknown>) {
    const response = await fetch(`/api/${type}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    return response.json();
}

export async function updateItemRequest(type: ItemType, id: number, data: Record<string, unknown>) {
    const response = await fetch(`/api/${type}/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    return response.json();
}

export async function deleteItemRequest(type: ItemType, id: number) {
    const response = await fetch(`/api/${type}/${id}`, {
        method: "DELETE",
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    return response.json();
}
