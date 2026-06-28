import { UserAvatar } from "../../components/UserAvatar";
import { SelectMenu } from "../../components/SelectMenu";
import { TableRowsSkeleton } from "../../components/LoadingState";
import type {
    AdminSecurityContext,
    ManagedUser,
    RoleFilter,
    SearchField,
    SortDirection,
    StatusFilter,
    UserSortField,
    VerificationFilter,
} from "../../types/admin";
import { displayRoleText, formatDate, shortId } from "../../utils/admin-format";

type UserTableProps = {
    users: ManagedUser[];
    selectedUserId: string;
    totalUsers: number;
    offset: number;
    pageSize: number;
    searchValue: string;
    searchField: SearchField;
    roleFilter: RoleFilter;
    statusFilter: StatusFilter;
    verificationFilter: VerificationFilter;
    sortBy: UserSortField;
    sortDirection: SortDirection;
    selectedUserIds: string[];
    roleOptions: string[];
    adminContext?: AdminSecurityContext | null;
    currentUser?: ManagedUser | null;
    loadingUsers: boolean;
    canSelectUser: (user: ManagedUser) => boolean;
    onSearchValueChange: (value: string) => void;
    onSearchFieldChange: (value: SearchField) => void;
    onRoleFilterChange: (value: RoleFilter) => void;
    onStatusFilterChange: (value: StatusFilter) => void;
    onVerificationFilterChange: (value: VerificationFilter) => void;
    onSortChange: (field: UserSortField) => void;
    onPageSizeChange: (value: number) => void;
    onSearch: () => void;
    onRefresh: () => void;
    onExportCsv: () => void;
    onSelectUser: (userId: string) => void;
    onToggleUserSelection: (userId: string) => void;
    onTogglePageSelection: () => void;
    onClearSelection: () => void;
    onBulkSetRole: (role: string) => void;
    onBulkBan: () => void;
    onBulkUnban: () => void;
    onPageChange: (offset: number) => void;
};

function sortMarker(field: UserSortField, sortBy: UserSortField, sortDirection: SortDirection) {
    if (field !== sortBy) return "";
    return sortDirection === "asc" ? "↑" : "↓";
}

export function UserTable({
    users,
    selectedUserId,
    totalUsers,
    offset,
    pageSize,
    searchValue,
    searchField,
    roleFilter,
    statusFilter,
    verificationFilter,
    sortBy,
    sortDirection,
    selectedUserIds,
    roleOptions,
    adminContext,
    currentUser,
    loadingUsers,
    canSelectUser,
    onSearchValueChange,
    onSearchFieldChange,
    onRoleFilterChange,
    onStatusFilterChange,
    onVerificationFilterChange,
    onSortChange,
    onPageSizeChange,
    onSearch,
    onRefresh,
    onExportCsv,
    onSelectUser,
    onToggleUserSelection,
    onTogglePageSelection,
    onClearSelection,
    onBulkSetRole,
    onBulkBan,
    onBulkUnban,
    onPageChange,
}: UserTableProps) {
    const selectableUsers = users.filter(canSelectUser);
    const selectedOnPageCount = selectableUsers.filter((user) => selectedUserIds.includes(user.id)).length;
    const hasBulkSelection = selectedUserIds.length > 0;
    const isPageSelectionChecked = selectableUsers.length > 0 && selectedOnPageCount === selectableUsers.length;

    return (
        <>
            <div className="panel-header">
                <div>
                    <h2>Пользователи</h2>
                    <p className="muted">Поиск, фильтры, сортировка и выбор пользователя для управления.</p>
                </div>
                <div className="actions-row">
                    <button className="secondary" onClick={onExportCsv} disabled={loadingUsers || !totalUsers}>
                        CSV
                    </button>
                    <button className="secondary" onClick={onRefresh} disabled={loadingUsers}>
                        Обновить
                    </button>
                </div>
            </div>

            <form
                className="toolbar user-toolbar"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSearch();
                }}
            >
                <input placeholder="Поиск" value={searchValue} onChange={(event) => onSearchValueChange(event.target.value)} />
                <SelectMenu value={searchField} onChange={(value) => onSearchFieldChange(value as SearchField)} options={[{ value: "email", label: "Email" }, { value: "name", label: "Имя" }]} />
                <SelectMenu value={roleFilter} onChange={(value) => onRoleFilterChange(value as RoleFilter)} options={[{ value: "all", label: "Все роли" }, { value: "admin", label: "admin" }, { value: "moderator", label: "moderator" }, { value: "user", label: "user" }]} />
                <SelectMenu value={statusFilter} onChange={(value) => onStatusFilterChange(value as StatusFilter)} options={[{ value: "all", label: "Все статусы" }, { value: "active", label: "Активные" }, { value: "banned", label: "Заблокированные" }]} />
                <SelectMenu value={verificationFilter} onChange={(value) => onVerificationFilterChange(value as VerificationFilter)} options={[{ value: "all", label: "Любой email" }, { value: "verified", label: "Email подтвержден" }, { value: "unverified", label: "Email не подтвержден" }]} />
                <button className="secondary" type="submit">
                    Найти
                </button>
            </form>

            {hasBulkSelection && (
                <div className="bulk-toolbar">
                    <strong>Выбрано: {selectedUserIds.length}</strong>
                    <SelectMenu value="" onChange={(value) => value && onBulkSetRole(value)} options={[{ value: "", label: "Изменить роль" }, ...roleOptions.map((role) => ({ value: role, label: role }))]} />
                    <button className="secondary" type="button" onClick={onBulkBan}>
                        Заблокировать
                    </button>
                    <button className="secondary" type="button" onClick={onBulkUnban}>
                        Разблокировать
                    </button>
                    <button className="link-button" type="button" onClick={onClearSelection}>
                        Сбросить выбор
                    </button>
                </div>
            )}

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th className="table-select-cell">
                                <input
                                    aria-label="Выбрать страницу"
                                    checked={isPageSelectionChecked}
                                    disabled={!selectableUsers.length}
                                    type="checkbox"
                                    onChange={onTogglePageSelection}
                                />
                            </th>
                            <th>
                                <button className="sort-button" type="button" onClick={() => onSortChange("email")}>
                                    Пользователь {sortMarker("email", sortBy, sortDirection)}
                                </button>
                            </th>
                            <th>
                                <button className="sort-button" type="button" onClick={() => onSortChange("role")}>
                                    Роль {sortMarker("role", sortBy, sortDirection)}
                                </button>
                            </th>
                            <th>Статус</th>
                            <th>Email</th>
                            <th>
                                <button className="sort-button" type="button" onClick={() => onSortChange("createdAt")}>
                                    Создан {sortMarker("createdAt", sortBy, sortDirection)}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr
                                key={user.id}
                                className={user.id === selectedUserId ? "selected-row" : ""}
                                onClick={() => onSelectUser(user.id)}
                            >
                                <td className="table-select-cell">
                                    <input
                                        aria-label={`Выбрать ${user.email}`}
                                        checked={selectedUserIds.includes(user.id)}
                                        disabled={!canSelectUser(user)}
                                        type="checkbox"
                                        onChange={() => onToggleUserSelection(user.id)}
                                        onClick={(event) => event.stopPropagation()}
                                    />
                                </td>
                                <td>
                                    <div className="user-cell">
                                        <UserAvatar user={user} size="sm" />
                                        <div>
                                            <div className="user-name-line">
                                                <strong>{user.name || "Без имени"}</strong>
                                                {user.id === currentUser?.id && <span className="self-badge">Это вы</span>}
                                            </div>
                                            <span>{user.email}</span>
                                            <small>{shortId(user.id)}</small>
                                        </div>
                                    </div>
                                </td>
                                <td>{displayRoleText(user, adminContext)}</td>
                                <td>{user.banned ? "Заблокирован" : "Активен"}</td>
                                <td>{user.emailVerified ? "Подтвержден" : "Не подтвержден"}</td>
                                <td>{formatDate(user.createdAt)}</td>
                            </tr>
                        ))}
                        {!users.length && (
                            loadingUsers
                                ? <TableRowsSkeleton columns={6} rows={7} />
                                : <tr><td colSpan={6}>Пользователи не найдены</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pagination">
                <button
                    className="secondary"
                    disabled={offset === 0 || loadingUsers}
                    onClick={() => onPageChange(Math.max(0, offset - pageSize))}
                >
                    Назад
                </button>
                <span>
                    {totalUsers ? offset + 1 : 0}-{Math.min(offset + pageSize, totalUsers || offset + users.length)} из {totalUsers}
                </span>
                <SelectMenu className="page-size-select" value={String(pageSize)} onChange={(value) => onPageSizeChange(Number(value))} options={[{ value: "10", label: "10" }, { value: "25", label: "25" }, { value: "50", label: "50" }]} />
                <button
                    className="secondary"
                    disabled={offset + pageSize >= totalUsers || loadingUsers}
                    onClick={() => onPageChange(offset + pageSize)}
                >
                    Далее
                </button>
            </div>
        </>
    );
}
