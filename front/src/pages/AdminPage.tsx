import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { AdminMessages } from "../features/admin/AdminMessages";
import { AdminStats } from "../features/admin/AdminStats";
import { AuditLogPanel } from "../features/admin/AuditLogPanel";
import { CreateUserForm } from "../features/admin/CreateUserForm";
import { UserDetailsPanel } from "../features/admin/UserDetailsPanel";
import { UserTable } from "../features/admin/UserTable";
import {
    adminApi,
    bulkBanManagedUsers,
    bulkSetManagedUserRole,
    bulkUnbanManagedUsers,
    exportAuditLogsCsv,
    exportManagedUsersCsv,
    getManagedUser,
    listAuditLogs,
    listManagedAccounts,
    listManagedUsers,
    setManagedUserEmailVerified,
    setManagedUserRole,
    unlinkManagedAccount,
} from "../lib/admin-api";
import { authApi } from "../lib/auth-api";
import type {
    AdminSecurityContext,
    AuditLogFilters,
    BanFormState,
    EditUserFormState,
    ManagedAuditLog,
    ManagedAccount,
    ManagedSession,
    ManagedUser,
    RoleFilter,
    SearchField,
    SortDirection,
    StatusFilter,
    UserSortField,
    VerificationFilter,
    UserFormState,
} from "../types/admin";
import { canManageUser, getErrorMessage, isAdminUser, isSuperAdminUser, manageableRoleOptions, roleText } from "../utils/admin-format";
import { unwrapAuthResult } from "../utils/auth-client-result";

type AdminPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onSessionRefresh: () => Promise<void>;
    onOpenAuthModal: () => void;
};

type UserQueryOverrides = Partial<{
    pageSize: number;
    roleFilter: RoleFilter;
    statusFilter: StatusFilter;
    verificationFilter: VerificationFilter;
    sortBy: UserSortField;
    sortDirection: SortDirection;
}>;

const emptyCreateForm: UserFormState = {
    name: "",
    email: "",
    password: "",
    role: "user",
};

const emptyAuditLogFilters: AuditLogFilters = {
    actorEmail: "",
    targetEmail: "",
    action: "",
    outcome: "",
    from: "",
    to: "",
};

const auditLogPageSize = 30;

export function AdminPage({ currentUser, adminContext, onSessionRefresh, onOpenAuthModal }: AdminPageProps) {
    const navigate = useNavigate();
    const { userId: routeUserId } = useParams<{ userId: string }>();
    const { confirm, dialog } = useConfirmDialog();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [selectedUserOverride, setSelectedUserOverride] = useState<ManagedUser | null>(null);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [offset, setOffset] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [searchValue, setSearchValue] = useState("");
    const [searchField, setSearchField] = useState<SearchField>("email");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
    const [sortBy, setSortBy] = useState<UserSortField>("createdAt");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [notice, setNotice] = useState("");
    const [adminError, setAdminError] = useState("");

    const [createForm, setCreateForm] = useState<UserFormState>(emptyCreateForm);
    const [editForm, setEditForm] = useState<EditUserFormState>({
        name: "",
        email: "",
        image: "",
        role: "user",
    });
    const [banForm, setBanForm] = useState<BanFormState>({
        reason: "",
        expiresAt: "",
    });
    const [newPassword, setNewPassword] = useState("");

    const [sessions, setSessions] = useState<ManagedSession[]>([]);
    const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [auditLogs, setAuditLogs] = useState<ManagedAuditLog[]>([]);
    const [selectedUserAuditLogs, setSelectedUserAuditLogs] = useState<ManagedAuditLog[]>([]);
    const [auditLogFilters, setAuditLogFilters] = useState<AuditLogFilters>(emptyAuditLogFilters);
    const [auditLogTotal, setAuditLogTotal] = useState(0);
    const [auditLogOffset, setAuditLogOffset] = useState(0);
    const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

    const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? selectedUserOverride, [selectedUserId, selectedUserOverride, users]);
    const roleOptions = useMemo(() => manageableRoleOptions(currentUser, adminContext), [adminContext, currentUser]);
    const canManageSelectedUser = canManageUser(currentUser, selectedUser, adminContext);
    const isSelfSelected = Boolean(currentUser?.id && selectedUser?.id === currentUser.id);
    const canUpdateSelectedProfile = canManageSelectedUser || isSelfSelected;
    const isSuperAdminSelected = isSuperAdminUser(selectedUser, adminContext);
    const superAdminUserKey = adminContext?.superAdminUserIds.join(",") ?? "";

    function getCurrentUserQueryInput(nextOffset = offset, overrides: UserQueryOverrides = {}) {
        return {
            limit: overrides.pageSize ?? pageSize,
            offset: nextOffset,
            searchValue,
            searchField,
            role: overrides.roleFilter ?? roleFilter,
            status: overrides.statusFilter ?? statusFilter,
            emailVerified: overrides.verificationFilter ?? verificationFilter,
            sortBy: overrides.sortBy ?? sortBy,
            sortDirection: overrides.sortDirection ?? sortDirection,
        };
    }

    async function loadUsers(nextOffset = offset, overrides: UserQueryOverrides = {}) {
        setLoadingUsers(true);
        setAdminError("");

        try {
            const response = await listManagedUsers(getCurrentUserQueryInput(nextOffset, overrides));
            const nextUsers = response.users ?? [];

            setUsers(nextUsers);
            setTotalUsers(response.total ?? 0);
            setOffset(nextOffset);
            setSelectedUserIds((value) => value.filter((userId) => nextUsers.some((user) => user.id === userId)));

            if (routeUserId) {
                setSelectedUserId(routeUserId);
                if (!nextUsers.some((user) => user.id === routeUserId)) {
                    void loadSelectedUserProfile(routeUserId);
                }
                return;
            }

            if (selectedUserId && !nextUsers.some((user) => user.id === selectedUserId)) {
                setSelectedUserId(nextUsers[0]?.id ?? "");
            }

            if (!selectedUserId && nextUsers[0]) {
                setSelectedUserId(nextUsers[0].id);
            }
        } catch (error) {
            setAdminError(getErrorMessage(error));
        } finally {
            setLoadingUsers(false);
        }
    }

    async function loadSelectedUserProfile(userId: string) {
        try {
            const response = await getManagedUser(userId);
            setSelectedUserOverride(response.user);
            setUsers((value) => value.map((user) => (user.id === userId ? response.user : user)));
        } catch (error) {
            setAdminError(getErrorMessage(error));
        }
    }

    async function loadUserDetails(userId: string) {
        if (!userId) return;
        void loadSelectedUserAuditLogs(userId);

        if (userId === currentUser?.id) {
            setAdminError("");
            setLoadingDetails(true);

            try {
                const ownSessions = await unwrapAuthResult<ManagedSession[]>(authApi.listSessions());
                setSessions(ownSessions ?? []);
                setAccounts([]);
            } catch (error) {
                setSessions([]);
                setAccounts([]);
                setAdminError(getErrorMessage(error));
            } finally {
                setLoadingDetails(false);
            }
            return;
        }

        if (adminContext?.superAdminUserIds.includes(userId)) {
            setAdminError("");
            setLoadingDetails(false);
            setSessions([]);
            setAccounts([]);
            return;
        }

        setLoadingDetails(true);
        setAdminError("");

        try {
            const [sessionResponse, accountResponse] = await Promise.all([unwrapAuthResult<{ sessions: ManagedSession[] }>(adminApi.listUserSessions({ userId })), listManagedAccounts(userId)]);

            setSessions(sessionResponse.sessions ?? []);
            setAccounts(accountResponse.accounts ?? []);
        } catch (error) {
            setAdminError(getErrorMessage(error));
        } finally {
            setLoadingDetails(false);
        }
    }

    async function loadSelectedUserAuditLogs(userId: string) {
        try {
            const response = await listAuditLogs({ limit: 12, userId });
            setSelectedUserAuditLogs(response.logs ?? []);
        } catch (error) {
            setAdminError(getErrorMessage(error));
        }
    }

    async function loadAuditLogs(nextOffset = auditLogOffset, nextFilters = auditLogFilters) {
        setLoadingAuditLogs(true);

        try {
            const response = await listAuditLogs({
                limit: auditLogPageSize,
                offset: nextOffset,
                ...nextFilters,
            });
            setAuditLogs(response.logs ?? []);
            setAuditLogTotal(response.total ?? 0);
            setAuditLogOffset(nextOffset);
        } catch (error) {
            setAdminError(getErrorMessage(error));
        } finally {
            setLoadingAuditLogs(false);
        }
    }

    async function runAction(action: () => Promise<void>, successMessage: string) {
        setNotice("");
        setAdminError("");

        try {
            await action();
            setNotice(successMessage);
            await loadUsers(offset);
            await loadAuditLogs();
            if (selectedUserId) {
                await loadSelectedUserProfile(selectedUserId);
                await loadUserDetails(selectedUserId);
                await loadSelectedUserAuditLogs(selectedUserId);
            }
        } catch (error) {
            setAdminError(getErrorMessage(error));
        }
    }

    function resetAuditFilters() {
        setAuditLogFilters(emptyAuditLogFilters);
        void loadAuditLogs(0, emptyAuditLogFilters);
    }

    function selectUser(userId: string) {
        setSelectedUserId(userId);
        setSelectedUserOverride(null);
        navigate(`/admin/users/${encodeURIComponent(userId)}`);
    }

    async function exportUsersCsv() {
        setNotice("");
        setAdminError("");

        try {
            const blob = await exportManagedUsersCsv(getCurrentUserQueryInput(0));
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.append(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setNotice("CSV выгрузка подготовлена");
            await loadAuditLogs();
        } catch (error) {
            setAdminError(getErrorMessage(error));
        }
    }

    async function exportAuditCsv() {
        setNotice("");
        setAdminError("");

        try {
            const blob = await exportAuditLogsCsv({
                ...auditLogFilters,
                limit: 5000,
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `audit-logs-export-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.append(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setNotice("CSV журнала действий подготовлен");
        } catch (error) {
            setAdminError(getErrorMessage(error));
        }
    }

    function canBulkSelectUser(user: ManagedUser) {
        return user.id !== currentUser?.id && canManageUser(currentUser, user, adminContext);
    }

    function toggleUserSelection(userId: string) {
        setSelectedUserIds((value) => (value.includes(userId) ? value.filter((item) => item !== userId) : [...value, userId]));
    }

    function togglePageSelection() {
        const selectableIds = users.filter(canBulkSelectUser).map((user) => user.id);
        const allSelected = selectableIds.length > 0 && selectableIds.every((userId) => selectedUserIds.includes(userId));

        setSelectedUserIds((value) => {
            if (allSelected) {
                return value.filter((userId) => !selectableIds.includes(userId));
            }

            return Array.from(new Set([...value, ...selectableIds]));
        });
    }

    function clearBulkSelection() {
        setSelectedUserIds([]);
    }

    async function runBulkAction(action: (selectedUsers: ManagedUser[]) => Promise<void>, successMessage: string) {
        const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id) && canBulkSelectUser(user));

        if (!selectedUsers.length) return;

        await runAction(async () => {
            await action(selectedUsers);
            setSelectedUserIds([]);
        }, successMessage);
    }

    async function bulkSetRole(role: string) {
        const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id) && canBulkSelectUser(user));
        if (!selectedUsers.length) return;

        const confirmed = await confirm({
            title: "Изменить роль",
            message: `Изменить роль на ${role} для ${selectedUsers.length} пользователей?`,
            confirmText: "Изменить",
        });
        if (!confirmed) return;

        await runBulkAction(async (items) => {
            const userIds = items.filter((user) => roleText(user) !== role).map((user) => user.id);
            if (userIds.length) {
                await bulkSetManagedUserRole(userIds, role);
            }
        }, "Роли выбранных пользователей обновлены");
    }

    async function bulkBanUsers() {
        const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id) && canBulkSelectUser(user));
        if (!selectedUsers.length) return;

        const confirmed = await confirm({
            title: "Заблокировать пользователей",
            message: `Заблокировать выбранных пользователей: ${selectedUsers.length}?`,
            confirmText: "Заблокировать",
            tone: "danger",
        });
        if (!confirmed) return;

        await runBulkAction(async (items) => {
            await bulkBanManagedUsers(
                items.map((user) => user.id),
                "Массовая блокировка",
            );
        }, "Выбранные пользователи заблокированы");
    }

    async function bulkUnbanUsers() {
        const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id) && canBulkSelectUser(user));
        if (!selectedUsers.length) return;

        const confirmed = await confirm({
            title: "Разблокировать пользователей",
            message: `Разблокировать выбранных пользователей: ${selectedUsers.length}?`,
            confirmText: "Разблокировать",
        });
        if (!confirmed) return;

        await runBulkAction(async (items) => {
            await bulkUnbanManagedUsers(items.map((user) => user.id));
        }, "Выбранные пользователи разблокированы");
    }

    async function createUser() {
        await runAction(async () => {
            const response = await unwrapAuthResult<{ user: ManagedUser }>(
                adminApi.createUser({
                    email: createForm.email,
                    password: createForm.password || undefined,
                    name: createForm.name,
                    role: createForm.role,
                }),
            );
            setSelectedUserId(response.user.id);
            setCreateForm(emptyCreateForm);
        }, "Пользователь создан");
    }

    async function updateUser() {
        if (!selectedUser) return;
        if (editForm.role !== roleText(selectedUser)) {
            const confirmed = await confirm({
                title: "Изменить роль",
                message: `Изменить роль пользователя ${selectedUser.email} на ${editForm.role}?`,
                confirmText: "Изменить",
            });
            if (!confirmed) return;
        }

        await runAction(async () => {
            await unwrapAuthResult(
                adminApi.updateUser({
                    userId: selectedUser.id,
                    data: {
                        name: editForm.name,
                        email: editForm.email,
                        image: editForm.image || null,
                    },
                }),
            );

            if (editForm.role !== roleText(selectedUser)) {
                await setManagedUserRole(selectedUser.id, editForm.role);
            }
        }, "Пользователь обновлен");
    }

    async function banUser() {
        if (!selectedUser) return;
        const confirmed = await confirm({
            title: "Заблокировать пользователя",
            message: `Заблокировать пользователя ${selectedUser.email}?`,
            confirmText: "Заблокировать",
            tone: "danger",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unwrapAuthResult(
                adminApi.banUser({
                    userId: selectedUser.id,
                    banReason: banForm.reason || undefined,
                    banExpiresIn: banForm.expiresAt ? Math.max(1, Math.round((new Date(banForm.expiresAt).getTime() - Date.now()) / 1000)) : undefined,
                }),
            );
        }, "Пользователь заблокирован");
    }

    async function unbanUser() {
        if (!selectedUser) return;
        const confirmed = await confirm({
            title: "Разблокировать пользователя",
            message: `Разблокировать пользователя ${selectedUser.email}?`,
            confirmText: "Разблокировать",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unwrapAuthResult(adminApi.unbanUser({ userId: selectedUser.id }));
        }, "Блокировка снята");
    }

    async function updatePassword() {
        if (!selectedUser || !newPassword) return;
        const confirmed = await confirm({
            title: "Сменить пароль",
            message: `Сменить пароль пользователя ${selectedUser.email}?`,
            confirmText: "Сменить",
            tone: "danger",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unwrapAuthResult(
                adminApi.setUserPassword({
                    userId: selectedUser.id,
                    newPassword,
                }),
            );
            setNewPassword("");
        }, "Пароль обновлен");
    }

    async function deleteUser() {
        if (!selectedUser) return;
        const confirmed = await confirm({
            title: "Удалить пользователя",
            message: `Удалить пользователя ${selectedUser.email}? Это действие нельзя отменить.`,
            confirmText: "Удалить",
            tone: "danger",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unwrapAuthResult(adminApi.removeUser({ userId: selectedUser.id }));
            setSelectedUserId("");
            setSelectedUserOverride(null);
            setSessions([]);
            setAccounts([]);
            navigate("/admin");
        }, "Пользователь удален");
    }

    async function impersonateUser() {
        if (!selectedUser) return;
        const confirmed = await confirm({
            title: "Войти как пользователь",
            message: `Войти как ${selectedUser.email}? Текущая сессия перейдет в режим impersonation.`,
            confirmText: "Войти",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unwrapAuthResult(adminApi.impersonateUser({ userId: selectedUser.id }));
            await onSessionRefresh();
        }, "Режим входа под пользователем включен");
    }

    async function verifyEmail(verified: boolean) {
        if (!selectedUser) return;
        await runAction(async () => {
            const { user } = await setManagedUserEmailVerified(selectedUser.id, verified);
            setSelectedUserOverride(user);
            await loadUsers(offset);
        }, verified ? "Email подтверждён" : "Подтверждение email снято");
    }

    async function revokeSession(token: string) {
        const confirmed = await confirm({
            title: "Отозвать сессию",
            message: "Отозвать эту сессию пользователя?",
            confirmText: "Отозвать",
            tone: "danger",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unwrapAuthResult(adminApi.revokeUserSession({ sessionToken: token }));
        }, "Сессия отозвана");
    }

    async function revokeAllSessions() {
        if (!selectedUser) return;
        const confirmed = await confirm({
            title: "Отозвать все сессии",
            message: `Отозвать все сессии пользователя ${selectedUser.email}?`,
            confirmText: "Отозвать все",
            tone: "danger",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unwrapAuthResult(adminApi.revokeUserSessions({ userId: selectedUser.id }));
        }, "Все сессии пользователя отозваны");
    }

    async function unlinkAccount(accountId: string) {
        if (!selectedUser) return;
        const confirmed = await confirm({
            title: "Отвязать аккаунт",
            message: "Отвязать этот аккаунт от пользователя?",
            confirmText: "Отвязать",
            tone: "danger",
        });
        if (!confirmed) return;

        await runAction(async () => {
            await unlinkManagedAccount(accountId, selectedUser.id);
        }, "Аккаунт отвязан");
    }

    useEffect(() => {
        if (!currentUser?.id) return;
        void loadUsers(0);
        void loadAuditLogs(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]);

    useEffect(() => {
        if (!routeUserId) return;
        setSelectedUserId(routeUserId);
        if (!users.some((user) => user.id === routeUserId)) {
            void loadSelectedUserProfile(routeUserId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeUserId]);

    useEffect(() => {
        if (!selectedUser) return;
        setEditForm({
            name: selectedUser.name ?? "",
            email: selectedUser.email ?? "",
            image: selectedUser.image ?? "",
            role: roleText(selectedUser),
        });
        setBanForm({
            reason: selectedUser.banReason ?? "",
            expiresAt: selectedUser.banExpires ? new Date(selectedUser.banExpires).toISOString().slice(0, 16) : "",
        });
        setNewPassword("");
        void loadUserDetails(selectedUser.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUser?.id, superAdminUserKey]);

    if (!currentUser) {
        return (
            <section className="admin-page">
                <div className="panel home-card" style={{ textAlign: "center" }}>
                    <h2>Доступ ограничен</h2>
                    <p className="muted">Для доступа к админ-панели необходимо войти в аккаунт.</p>
                    <button className="primary" onClick={onOpenAuthModal}>
                        Войти / Зарегистрироваться
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="admin-page">
            <div className="page-heading">
                <p className="eyebrow">Администрирование</p>
                <h2>Админ панель</h2>
                <p className="muted">Управление пользователями, сессиями, ролями, блокировками и связанными аккаунтами.</p>
            </div>

            <AdminMessages notice={notice} error={adminError} />
            <AdminStats totalUsers={totalUsers} visibleUsers={users.length} selectedUser={selectedUser} />

            <section className="workspace">
                <section className="panel users-panel">
                    <UserTable
                        users={users}
                        selectedUserId={selectedUserId}
                        totalUsers={totalUsers}
                        offset={offset}
                        pageSize={pageSize}
                        searchValue={searchValue}
                        searchField={searchField}
                        roleFilter={roleFilter}
                        statusFilter={statusFilter}
                        verificationFilter={verificationFilter}
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        selectedUserIds={selectedUserIds}
                        roleOptions={roleOptions}
                        adminContext={adminContext}
                        currentUser={currentUser}
                        loadingUsers={loadingUsers}
                        canSelectUser={canBulkSelectUser}
                        onSearchValueChange={setSearchValue}
                        onSearchFieldChange={setSearchField}
                        onRoleFilterChange={setRoleFilter}
                        onStatusFilterChange={setStatusFilter}
                        onVerificationFilterChange={setVerificationFilter}
                        onSortChange={(field) => {
                            const nextDirection = field === sortBy ? (sortDirection === "asc" ? "desc" : "asc") : field === "email" || field === "name" || field === "role" ? "asc" : "desc";
                            if (field === sortBy) {
                                setSortDirection(nextDirection);
                            } else {
                                setSortBy(field);
                                setSortDirection(nextDirection);
                            }

                            void loadUsers(0, { sortBy: field, sortDirection: nextDirection });
                        }}
                        onPageSizeChange={(value) => {
                            setPageSize(value);
                            void loadUsers(0, { pageSize: value });
                        }}
                        onSearch={() => loadUsers(0)}
                        onRefresh={() => loadUsers(0)}
                        onExportCsv={exportUsersCsv}
                        onSelectUser={selectUser}
                        onToggleUserSelection={toggleUserSelection}
                        onTogglePageSelection={togglePageSelection}
                        onClearSelection={clearBulkSelection}
                        onBulkSetRole={bulkSetRole}
                        onBulkBan={bulkBanUsers}
                        onBulkUnban={bulkUnbanUsers}
                        onPageChange={loadUsers}
                    />

                    {/* Creating users is admin-only — moderators get list/edit/ban/role only (see admin-roles.ts). */}
                    {(isAdminUser(currentUser) || isSuperAdminUser(currentUser, adminContext)) && (
                        <CreateUserForm form={createForm} roleOptions={roleOptions} onChange={setCreateForm} onSubmit={createUser} />
                    )}
                </section>

                <UserDetailsPanel
                    selectedUser={selectedUser}
                    editForm={editForm}
                    banForm={banForm}
                    newPassword={newPassword}
                    sessions={sessions}
                    accounts={accounts}
                    auditLogs={selectedUserAuditLogs}
                    loadingDetails={loadingDetails}
                    roleOptions={roleOptions}
                    canManageSelectedUser={canManageSelectedUser}
                    canUpdateSelectedProfile={canUpdateSelectedProfile}
                    canImpersonate={isAdminUser(currentUser) || isSuperAdminUser(currentUser, adminContext)}
                    canVerifyEmail={isAdminUser(currentUser) || isSuperAdminUser(currentUser, adminContext)}
                    isSelfSelected={isSelfSelected}
                    isSuperAdminSelected={isSuperAdminSelected}
                    onEditFormChange={setEditForm}
                    onBanFormChange={setBanForm}
                    onNewPasswordChange={setNewPassword}
                    onUpdateUser={updateUser}
                    onDeleteUser={deleteUser}
                    onBanUser={banUser}
                    onUnbanUser={unbanUser}
                    onUpdatePassword={updatePassword}
                    onImpersonateUser={impersonateUser}
                    onVerifyEmail={verifyEmail}
                    onRevokeSession={revokeSession}
                    onRevokeAllSessions={revokeAllSessions}
                    onUnlinkAccount={unlinkAccount}
                />
            </section>

            <AuditLogPanel
                logs={auditLogs}
                filters={auditLogFilters}
                total={auditLogTotal}
                offset={auditLogOffset}
                pageSize={auditLogPageSize}
                loading={loadingAuditLogs}
                onFiltersChange={setAuditLogFilters}
                onRefresh={() => loadAuditLogs(auditLogOffset)}
                onApplyFilters={() => loadAuditLogs(0)}
                onResetFilters={resetAuditFilters}
                onPageChange={(nextOffset) => loadAuditLogs(nextOffset)}
                onExportCsv={exportAuditCsv}
            />
            {dialog}
        </section>
    );
}
