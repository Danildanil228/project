export type ManagedUser = {
    id: string;
    name: string;
    email: string;
    emailVerified?: boolean;
    image?: string | null;
    role?: string | string[] | null;
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: string | Date | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;
};

export type ManagedSession = {
    id: string;
    token: string;
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    expiresAt?: string | Date;
    createdAt?: string | Date;
};

export type ManagedAccount = {
    id: string;
    providerId: string;
    accountId: string;
    userId: string;
    scope?: string | null;
    createdAt?: string;
    updatedAt?: string;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    hasIdToken: boolean;
    hasPassword: boolean;
};

export type ManagedAuditLog = {
    id: string;
    actorId?: string | null;
    actorEmail?: string | null;
    actorRole?: string | null;
    action: string;
    targetUserId?: string | null;
    targetEmail?: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
};

export type AdminSecurityContext = {
    currentUserId: string;
    hasElevatedAccess: boolean;
    isSuperAdmin: boolean;
    superAdminUserIds: string[];
};

export type ListUsersResponse = {
    users: ManagedUser[];
    total: number;
    limit?: number;
    offset?: number;
};

export type ListAuditLogsResponse = {
    logs: ManagedAuditLog[];
    total: number;
    limit?: number;
    offset?: number;
};

export type AuthClientResult<T> = {
    data?: T | null;
    error?: {
        message?: string;
        code?: string;
        status?: number;
    } | null;
};

export type AdminClientApi = {
    listUsers(input?: unknown): Promise<AuthClientResult<ListUsersResponse> | ListUsersResponse>;
    createUser(input: unknown): Promise<AuthClientResult<{ user: ManagedUser }> | { user: ManagedUser }>;
    updateUser(input: unknown): Promise<AuthClientResult<ManagedUser> | ManagedUser>;
    setRole(input: unknown): Promise<AuthClientResult<{ user: ManagedUser }> | { user: ManagedUser }>;
    banUser(input: unknown): Promise<AuthClientResult<{ user: ManagedUser }> | { user: ManagedUser }>;
    unbanUser(input: unknown): Promise<AuthClientResult<{ user: ManagedUser }> | { user: ManagedUser }>;
    removeUser(input: unknown): Promise<AuthClientResult<unknown> | unknown>;
    setUserPassword(input: unknown): Promise<AuthClientResult<{ status: boolean }> | { status: boolean }>;
    listUserSessions(input: unknown): Promise<AuthClientResult<{ sessions: ManagedSession[] }> | { sessions: ManagedSession[] }>;
    revokeUserSession(input: unknown): Promise<AuthClientResult<{ success: boolean }> | { success: boolean }>;
    revokeUserSessions(input: unknown): Promise<AuthClientResult<{ success: boolean }> | { success: boolean }>;
    impersonateUser(input: unknown): Promise<AuthClientResult<unknown> | unknown>;
    stopImpersonating(): Promise<AuthClientResult<unknown> | unknown>;
};

export type AuthApi = {
    updateUser(input: unknown): Promise<AuthClientResult<{ status: boolean }> | { status: boolean }>;
    changePassword(input: unknown): Promise<AuthClientResult<unknown> | unknown>;
    sendVerificationEmail(input: unknown): Promise<AuthClientResult<{ status: boolean }> | { status: boolean }>;
    requestPasswordReset(input: unknown): Promise<AuthClientResult<{ status: boolean; message: string }> | { status: boolean; message: string }>;
    resetPassword(input: unknown): Promise<AuthClientResult<{ status: boolean }> | { status: boolean }>;
    listSessions(): Promise<AuthClientResult<ManagedSession[]> | ManagedSession[]>;
    revokeSession(input: unknown): Promise<AuthClientResult<{ status: boolean }> | { status: boolean }>;
    revokeSessions(): Promise<AuthClientResult<{ status: boolean }> | { status: boolean }>;
};

export type SearchField = "email" | "name";
export type UserSortField = "createdAt" | "updatedAt" | "email" | "name" | "role";
export type SortDirection = "asc" | "desc";
export type RoleFilter = "all" | AppRole;
export type StatusFilter = "all" | "active" | "banned";
export type VerificationFilter = "all" | "verified" | "unverified";

export type AppRole = "admin" | "moderator" | "user";

export type UserFormState = {
    name: string;
    email: string;
    password: string;
    role: string;
};

export type EditUserFormState = {
    name: string;
    email: string;
    image: string;
    role: string;
};

export type BanFormState = {
    reason: string;
    expiresAt: string;
};

export type AuditLogFilters = {
    actorEmail: string;
    targetEmail: string;
    action: string;
    from: string;
    to: string;
};
