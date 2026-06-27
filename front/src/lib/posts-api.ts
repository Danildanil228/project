import type {
    AuthorProfile,
    CreatePostInput,
    FeedItem,
    FeedSort,
    FeedTrophyFilter,
    FishingMethod,
    ModerationQueueRow,
    MyPostRow,
    PostContentInput,
    PostDetail,
    PostStatus,
} from "../types/post";

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

export function createPost(input: CreatePostInput) {
    return requestJson<{ post: PostDetail }>(`/api/posts`, withBody("POST", input));
}

// Updates a draft/rejected post; pass submit=true inside the payload to send it for review in one call.
export function updatePost(id: number, input: CreatePostInput) {
    return requestJson<{ post: PostDetail }>(`/api/posts/${id}`, withBody("PATCH", input));
}

export function submitPost(id: number) {
    return requestJson<{ post: PostDetail }>(`/api/posts/${id}/submit`, { method: "POST" });
}

export function deletePost(id: number) {
    return requestJson<{ ok: true }>(`/api/posts/${id}`, { method: "DELETE" });
}

export function getPost(id: number) {
    return requestJson<{ post: PostDetail }>(`/api/posts/${id}`);
}

// Fire-and-forget view increment; we don't care about the result, only that the request goes out.
export function recordPostView(id: number) {
    return requestJson<{ ok: true }>(`/api/posts/${id}/view`, { method: "POST" });
}

export function listMyPosts(params: { status?: PostStatus | ""; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    query.set("limit", String(params.limit ?? 20));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<ListResponse<MyPostRow>>(`/api/posts/mine?${query.toString()}`);
}

export type FeedParams = {
    search?: string;
    fishIds?: number[];
    waterbodyIds?: number[];
    fishingMethod?: FishingMethod | "";
    trophyType?: FeedTrophyFilter;
    sortBy?: FeedSort;
    limit?: number;
    offset?: number;
};

export function listFeed(params: FeedParams = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.fishIds?.length) query.set("fishIds", params.fishIds.join(","));
    if (params.waterbodyIds?.length) query.set("waterbodyIds", params.waterbodyIds.join(","));
    if (params.fishingMethod) query.set("fishingMethod", params.fishingMethod);
    if (params.trophyType) query.set("trophyType", params.trophyType);
    if (params.sortBy) query.set("sortBy", params.sortBy);
    query.set("limit", String(params.limit ?? 20));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<ListResponse<FeedItem>>(`/api/posts/feed?${query.toString()}`);
}

export function getAuthorProfile(authorId: string, params: { limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    query.set("limit", String(params.limit ?? 20));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<AuthorProfile>(`/api/posts/author/${encodeURIComponent(authorId)}?${query.toString()}`);
}

// Moderation
export function listModerationQueue(params: { status?: "pending" | "in_review" | ""; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    query.set("limit", String(params.limit ?? 20));
    query.set("offset", String(params.offset ?? 0));
    return requestJson<ListResponse<ModerationQueueRow>>(`/api/posts/moderation/queue?${query.toString()}`);
}

export function claimPost(id: number) {
    return requestJson<{ post: PostDetail }>(`/api/posts/${id}/claim`, { method: "POST" });
}
export function releasePost(id: number) {
    return requestJson<{ ok: true }>(`/api/posts/${id}/release`, { method: "POST" });
}
export function approvePost(id: number) {
    return requestJson<{ post: PostDetail }>(`/api/posts/${id}/approve`, { method: "POST" });
}
export function rejectPost(id: number, reason: string) {
    return requestJson<{ ok: true }>(`/api/posts/${id}/reject`, withBody("POST", { reason }));
}
export function removeModeratedPost(id: number) {
    return requestJson<{ ok: true }>(`/api/posts/${id}/remove`, { method: "POST" });
}
export function pinPost(id: number) {
    return requestJson<{ ok: true }>(`/api/posts/${id}/pin`, { method: "POST" });
}
export function unpinPost(id: number) {
    return requestJson<{ ok: true }>(`/api/posts/${id}/pin`, { method: "DELETE" });
}
export function getPinInfo() {
    return requestJson<{ used: number; limit: number }>(`/api/posts/moderation/pin-info`);
}

export function moderatorEditPost(id: number, content: PostContentInput) {
    const payload = {
        ...content,
        description: content.description.trim(),
        point: content.point?.trim() ? content.point.trim() : null,
    };
    return requestJson<{ post: PostDetail }>(`/api/posts/${id}/moderate`, withBody("PATCH", payload));
}

export async function uploadPostMedia(file: File): Promise<{ url: string }> {
    const response = await fetch(`/api/uploads/post-media`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
    });
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    return response.json();
}

// Builds the API payload from the editor form, normalising blanks to nulls.
export function toPostPayload(content: PostContentInput, options: { submit: boolean; skipModeration?: boolean; isCurated?: boolean; curatedLabel?: string | null }): CreatePostInput {
    return {
        ...content,
        description: content.description.trim(),
        point: content.point?.trim() ? content.point.trim() : null,
        submit: options.submit,
        skipModeration: options.skipModeration ?? false,
        isCurated: options.isCurated ?? false,
        curatedLabel: options.curatedLabel?.trim() ? options.curatedLabel.trim() : null,
    };
}
