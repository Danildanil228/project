import type { CommentRow, NotificationRow, ReactionSummary, ReportRow, ReportStatus } from "../types/post";

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

// Comments
export function listComments(postId: number, params: { limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    query.set("limit", String(params.limit ?? 50));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<ListResponse<CommentRow>>(`/api/posts/${postId}/comments?${query.toString()}`);
}
export function addComment(postId: number, body: string) {
    return requestJson<{ comment: CommentRow }>(`/api/posts/${postId}/comments`, withBody("POST", { body }));
}
export function deleteComment(postId: number, commentId: number) {
    return requestJson<{ ok: true }>(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
}

// Reactions
export function getReactions(postId: number) {
    return requestJson<ReactionSummary>(`/api/posts/${postId}/reactions`);
}
export function setReaction(postId: number, value: 1 | -1) {
    return requestJson<{ summary: ReactionSummary }>(`/api/posts/${postId}/reactions`, withBody("POST", { value }));
}

// Reports
export function reportPost(postId: number, reason: string) {
    return requestJson<{ ok: true }>(`/api/posts/${postId}/reports`, withBody("POST", { reason }));
}
export function listReports(params: { status?: ReportStatus | ""; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status !== undefined) query.set("status", params.status);
    query.set("limit", String(params.limit ?? 20));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<ListResponse<ReportRow>>(`/api/reports?${query.toString()}`);
}
export function reportsOpenCount() {
    return requestJson<{ open: number }>(`/api/reports/count`);
}
export function resolveReport(reportId: number, status: "resolved" | "rejected") {
    return requestJson<{ ok: true }>(`/api/reports/${reportId}/resolve`, withBody("POST", { status }));
}

// Notifications
export function listNotifications(params: { unreadOnly?: boolean; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    query.set("unreadOnly", params.unreadOnly ? "true" : "false");
    query.set("limit", String(params.limit ?? 20));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<ListResponse<NotificationRow>>(`/api/notifications?${query.toString()}`);
}
export function notificationsUnreadCount() {
    return requestJson<{ unread: number }>(`/api/notifications/unread-count`);
}
export function markNotificationsRead(ids?: number[]) {
    return requestJson<{ unread: number }>(`/api/notifications/read`, withBody("POST", ids ? { ids } : {}));
}
