import { UserAvatar } from "../../components/UserAvatar";
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
                <select value={searchField} onChange={(event) => onSearchFieldChange(event.target.value as SearchField)}>
                    <option value="email">Email</option>
                    <option value="name">Имя</option>
                </select>
                <select value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value as RoleFilter)}>
                    <option value="all">Все роли</option>
                    <option value="admin">admin</option>
                    <option value="moderator">moderator</option>
                    <option value="user">user</option>
                </select>
                <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as StatusFilter)}>
                    <option value="all">Все статусы</option>
                    <option value="active">Активные</option>
                    <option value="banned">Заблокированные</option>
                </select>
                <select value={verificationFilter} onChange={(event) => onVerificationFilterChange(event.target.value as VerificationFilter)}>
                    <option value="all">Любой email</option>
                    <option value="verified">Email подтвержден</option>
                    <option value="unverified">Email не подтвержден</option>
                </select>
                <button className="secondary" type="submit">
                    Найти
                </button>
            </form>

            {hasBulkSelection && (
                <div className="bulk-toolbar">
                    <strong>Выбрано: {selectedUserIds.length}</strong>
                    <select defaultValue="" onChange={(event) => event.target.value && onBulkSetRole(event.target.value)}>
                        <option value="" disabled>
                            Изменить роль
                        </option>
                        {roleOptions.map((role) => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </select>
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
                            <tr>
                                <td colSpan={6}>{loadingUsers ? "Загрузка..." : "Пользователи не найдены"}</td>
                            </tr>
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
                <select className="page-size-select" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                </select>
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
