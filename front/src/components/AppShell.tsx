import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { displayRoleText, hasElevatedUserAccess } from "../utils/admin-format";
import { UserAvatar } from "./UserAvatar";

type AppShellProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    isImpersonating: boolean;
    onLogout: () => Promise<void>;
    onStopImpersonating: () => Promise<void>;
};

export function AppShell({ currentUser, adminContext, isImpersonating, onLogout, onStopImpersonating }: AppShellProps) {
    const location = useLocation();
    const title = location.pathname.startsWith("/admin") ? "Админ панель" : "Главная";

    return (
        <main className="app-layout">
            <header className="topbar">
                <div>
                    <p className="eyebrow">Панель управления</p>
                    <h1>{title}</h1>
                </div>

                <div className="topbar-actions">
                    <nav className="main-nav" aria-label="Основная навигация">
                        <NavLink to="/" end>
                            Главная
                        </NavLink>
                        <NavLink to="/profile">Профиль</NavLink>
                        {hasElevatedUserAccess(currentUser, adminContext) && <NavLink to="/admin">Админ панель</NavLink>}
                    </nav>

                    <div className="current-user">
                        <UserAvatar user={currentUser} size="sm" />
                        <div>
                            <strong>{currentUser?.name || currentUser?.email}</strong>
                            <span>{currentUser?.email}</span>
                            <span>Роль: {displayRoleText(currentUser, adminContext)}</span>
                        </div>
                    </div>

                    {isImpersonating && (
                        <button className="secondary" onClick={onStopImpersonating}>
                            Остановить impersonation
                        </button>
                    )}

                    <button className="secondary" onClick={onLogout}>
                        Выйти
                    </button>
                </div>
            </header>

            <Outlet />
        </main>
    );
}
