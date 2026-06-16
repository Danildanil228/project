import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { canManageCatalog, displayRoleText, hasElevatedUserAccess } from "../utils/admin-format";
import { UserAvatar } from "./UserAvatar";
import { ModeToggle } from "./mode-toggle";

type AppShellProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    isImpersonating: boolean;
    onLogout: () => Promise<void>;
    onStopImpersonating: () => Promise<void>;
    onOpenAuthModal: () => void;
};

export function AppShell({ currentUser, adminContext, isImpersonating, onLogout, onStopImpersonating, onOpenAuthModal }: AppShellProps) {
    const location = useLocation();
    const title = location.pathname.startsWith("/admin") ? "Админ панель" : "Главная";

    const handleNavClick = (e: React.MouseEvent) => {
        if (!currentUser) {
            e.preventDefault();
            onOpenAuthModal();
        }
    };

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
                        <NavLink to="/catalog">
                            Каталог
                        </NavLink>
                        <NavLink to="/profile" onClick={handleNavClick}>
                            Профиль
                        </NavLink>
                        {hasElevatedUserAccess(currentUser, adminContext) && (
                            <NavLink to="/admin" onClick={handleNavClick}>
                                Админ панель
                            </NavLink>
                        )}
                        {canManageCatalog(currentUser, adminContext) && (
                            <NavLink to="/admin/reference" onClick={handleNavClick}>
                                Справочники
                            </NavLink>
                        )}
                    </nav>

                    <div className="current-user">
                        <UserAvatar user={currentUser} size="sm" />
                        <div>
                            <strong>{currentUser?.name || currentUser?.email || "Гость"}</strong>
                            <span>{currentUser?.email || "Не авторизован"}</span>
                            <span>Роль: {displayRoleText(currentUser, adminContext)}</span>
                        </div>
                    </div>

                    {isImpersonating && (
                        <button className="secondary" onClick={onStopImpersonating}>
                            Остановить impersonation
                        </button>
                    )}
                    <ModeToggle />

                    {currentUser ? (
                        <button className="secondary" onClick={onLogout}>
                            Выйти
                        </button>
                    ) : (
                        <button className="primary" onClick={onOpenAuthModal}>
                            Войти
                        </button>
                    )}
                </div>
            </header>

            <Outlet />
        </main>
    );
}
