import { authClient } from "./auth-client";
import type {
    AdminClientApi,
    AdminSecurityContext,
    ListUsersResponse,
    ListAuditLogsResponse,
    ManagedAccount,
    RoleFilter,
    SearchField,
    SortDirection,
    StatusFilter,
    UserSortField,
    VerificationFilter,
    ManagedAuditLog,
    ManagedUser,
    AuditLogFilters,
} from "../types/admin";

export const adminApi = authClient.admin as unknown as AdminClientApi;

async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.message || `Request failed with ${response.status}`;
}

export async function listManagedAccounts(userId: string) {
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<{ accounts: ManagedAccount[] }>;
}

export async function getAdminContext() {
    const response = await fetch("/api/admin/context", {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<AdminSecurityContext>;
}

export type AdminOverview = {
    counts: { total: number; newLast30Days: number; unverified: number; banned: number };
    recentActions: ManagedAuditLog[];
};

export async function getAdminOverviewData(): Promise<AdminOverview> {
    const response = await fetch("/api/admin/overview", { credentials: "include" });
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<AdminOverview>;
}

type ListAuditLogsInput = Partial<AuditLogFilters> & {
    limit?: number;
    offset?: number;
    targetUserId?: string;
    userId?: string;
};

function buildAuditLogParams(input: ListAuditLogsInput = {}, includePaging = true) {
    const params = new URLSearchParams();

    if (includePaging) {
        params.set("limit", String(input.limit ?? 30));
        params.set("offset", String(input.offset ?? 0));
    } else if (input.limit) {
        params.set("limit", String(input.limit));
    }

    for (const key of ["targetUserId", "userId", "actorEmail", "targetEmail", "action", "outcome", "from", "to"] as const) {
        const value = input[key];
        if (value) {
            params.set(key, key === "from" || key === "to" ? new Date(value).toISOString() : value);
        }
    }

    return params;
}

export async function listAuditLogs(input: ListAuditLogsInput = {}) {
    const params = buildAuditLogParams(input);

    const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<ListAuditLogsResponse>;
}

export async function exportAuditLogsCsv(input: ListAuditLogsInput = {}) {
    const params = buildAuditLogParams({ ...input, limit: input.limit ?? 5000 }, false);
    const response = await fetch(`/api/admin/audit-logs/export.csv?${params.toString()}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.blob();
}

type ListManagedUsersInput = {
    limit: number;
    offset: number;
    searchValue: string;
    searchField: SearchField;
    role: RoleFilter;
    status: StatusFilter;
    emailVerified: VerificationFilter;
    sortBy: UserSortField;
    sortDirection: SortDirection;
};

function buildManagedUsersParams(input: ListManagedUsersInput, includePaging = true) {
    const params = new URLSearchParams({
        sortBy: input.sortBy,
        sortDirection: input.sortDirection,
    });

    if (includePaging) {
        params.set("limit", String(input.limit));
        params.set("offset", String(input.offset));
    }

    if (input.searchValue.trim()) {
        params.set("searchValue", input.searchValue.trim());
        params.set("searchField", input.searchField);
    }

    if (input.role !== "all") {
        params.set("role", input.role);
    }

    if (input.status !== "all") {
        params.set("status", input.status);
    }

    if (input.emailVerified !== "all") {
        params.set("emailVerified", String(input.emailVerified === "verified"));
    }

    return params;
}

export async function listManagedUsers(input: ListManagedUsersInput) {
    const params = buildManagedUsersParams(input);

    const response = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<ListUsersResponse>;
}

export async function getManagedUser(userId: string) {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<{ user: ManagedUser }>;
}

export async function exportManagedUsersCsv(input: ListManagedUsersInput) {
    const params = buildManagedUsersParams(input, false);
    const response = await fetch(`/api/admin/users/export.csv?${params.toString()}`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.blob();
}

export async function unlinkManagedAccount(accountId: string, userId: string) {
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(accountId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<{ account: ManagedAccount }>;
}

export async function setManagedUserRole(userId: string, role: string) {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<{ user: ManagedUser }>;
}

export async function setManagedUserEmailVerified(userId: string, verified: boolean) {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email-verified`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified }),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<{ user: ManagedUser }>;
}

async function postBulkAction(path: string, body: unknown) {
    const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(await readError(response));
    }

    return response.json() as Promise<{ updated: number }>;
}

export async function bulkSetManagedUserRole(userIds: string[], role: string) {
    return postBulkAction("/api/admin/users/bulk-role", { userIds, role });
}

export async function bulkBanManagedUsers(userIds: string[], reason?: string) {
    return postBulkAction("/api/admin/users/bulk-ban", { userIds, reason });
}

export async function bulkUnbanManagedUsers(userIds: string[]) {
    return postBulkAction("/api/admin/users/bulk-unban", { userIds });
}
