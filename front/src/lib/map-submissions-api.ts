import type { MapSubmission, MapSubmissionApproval, MapSubmissionStatus } from "../types/map-submission";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { credentials: "include", ...init });
    if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || `Запрос не выполнен (${response.status})`);
    }
    return response.json();
}

function jsonBody(body: unknown): RequestInit {
    return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function listMapSubmissions(params: { status?: MapSubmissionStatus | ""; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams({ status: params.status ?? "pending", limit: String(params.limit ?? 30), offset: String(params.offset ?? 0) });
    return requestJson<{ items: MapSubmission[]; total: number; limit: number; offset: number }>(`/api/map-submissions?${query}`);
}

export function approveMapSubmission(id: number, input: MapSubmissionApproval) {
    return requestJson<{ status: "ok"; spotId: number }>(`/api/map-submissions/${id}/approve`, jsonBody(input));
}

export function rejectMapSubmission(id: number, reason: string) {
    return requestJson<{ status: "ok" }>(`/api/map-submissions/${id}/reject`, jsonBody({ reason }));
}
