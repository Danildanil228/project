import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Suspense, useEffect, useRef, useState } from "react";
import {
    BookOpen,
    Calculator,
    ChevronDown,
    Crown,
    Database,
    FileText,
    Fish,
    Home,
    LogIn,
    LogOut,
    Map as MapIcon,
    Menu,
    Newspaper,
    Scale,
    Settings,
    ShieldCheck,
    User as UserIcon,
    UserCog,
    Users,
    X,
} from "lucide-react";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { canManageCatalog, displayRoleText, hasElevatedUserAccess } from "../utils/admin-format";
import { UserAvatar } from "./UserAvatar";
import { ModeToggle } from "./mode-toggle";
import { NotificationsBell } from "./NotificationsBell";
import { useComparison } from "../context/ComparisonContext";
import { RoutePageSkeleton } from "./PageSkeletons";

type AppShellProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    isImpersonating: boolean;
    onLogout: () => Promise<void>;
    onStopImpersonating: () => Promise<void>;
    onOpenAuthModal: () => void;
};

type NavItem = { to: string; label: string; icon: typeof Home; end?: boolean; requiresAuth?: boolean };
type NavGroup = { title: string; items: NavItem[] };

export function AppShell({ currentUser, adminContext, isImpersonating, onLogout, onStopImpersonating, onOpenAuthModal }: AppShellProps) {
    const comparison = useComparison();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const elevated = hasElevatedUserAccess(currentUser, adminContext);
    const catalogAdmin = canManageCatalog(currentUser, adminContext);

    const groups: NavGroup[] = [
        {
            title: "Контент",
            items: [
                { to: "/", label: "Главная", icon: Home, end: true },
                { to: "/feed", label: "Лента", icon: Newspaper },
                { to: "/catalog", label: "Каталог", icon: BookOpen },
                { to: "/comparison", label: comparison.ids.length ? `Сравнение (${comparison.ids.length})` : "Сравнение", icon: Scale },
                { to: "/calculator", label: "Прочность", icon: Calculator },
                { to: "/waterbodies", label: "Водоёмы", icon: MapIcon },
            ],
        },
        {
            title: "Аккаунт",
            items: [
                { to: "/profile", label: "Профиль", icon: UserIcon, requiresAuth: true },
            ],
        },
    ];

    if (elevated || catalogAdmin) {
        const adminItems: NavItem[] = [];
        if (elevated) adminItems.push({ to: "/moderation", label: "Модерация", icon: ShieldCheck, requiresAuth: true });
        if (elevated) adminItems.push({ to: "/admin", label: "Сводка", icon: Crown, end: true, requiresAuth: true });
        if (elevated) adminItems.push({ to: "/admin/users", label: "Пользователи", icon: Users, requiresAuth: true });
        if (elevated) adminItems.push({ to: "/admin/audit", label: "Журнал", icon: FileText, requiresAuth: true });
        if (catalogAdmin) adminItems.push({ to: "/admin/reference", label: "Справочники", icon: Database, requiresAuth: true });
        groups.push({ title: "Управление", items: adminItems });
    }

    function handleNavClick(event: React.MouseEvent, requiresAuth?: boolean) {
        setMobileOpen(false);
        if (requiresAuth && !currentUser) {
            event.preventDefault();
            onOpenAuthModal();
        }
    }

    // Close mobile drawer on route change.
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    // Close user dropdown on outside click.
    useEffect(() => {
        if (!userMenuOpen) return;
        function onDown(event: MouseEvent) {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [userMenuOpen]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Mobile-only backdrop when drawer is open */}
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Закрыть меню"
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                {/* Brand */}
                <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-5 py-4">
                    <NavLink to="/" className="flex items-center gap-2">
                        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                            <Fish size={18} />
                        </span>
                        <span className="grid leading-tight">
                            <span className="text-sm font-extrabold tracking-tight">RF4 Community</span>
                            <span className="text-xs text-muted-foreground">Дневник рыбалки</span>
                        </span>
                    </NavLink>
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        className="lg:hidden grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Закрыть"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Основная навигация">
                    {groups.map((group) => (
                        <div key={group.title} className="mb-4 last:mb-0">
                            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {group.title}
                            </p>
                            <ul className="grid gap-1">
                                {group.items.map(({ to, label, icon: Icon, end, requiresAuth }) => (
                                    <li key={to}>
                                        <NavLink
                                            to={to}
                                            end={end}
                                            onClick={(event) => handleNavClick(event, requiresAuth)}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                    isActive
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                                                }`
                                            }
                                        >
                                            <Icon size={16} className="shrink-0" />
                                            <span className="truncate">{label}</span>
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer of sidebar: theme toggle + version */}
                <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-3 py-3">
                    <ModeToggle />
                    <span className="text-[10px] text-muted-foreground">v0.1 · dev</span>
                </div>
            </aside>

            {/* Main area */}
            <div className="lg:pl-64">
                {/* Top bar */}
                <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur sm:px-6">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        className="lg:hidden grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary"
                        aria-label="Открыть меню"
                    >
                        <Menu size={18} />
                    </button>

                    <div className="hidden flex-1 items-center gap-3 lg:flex">
                        {isImpersonating && (
                            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-foreground">
                                <UserCog size={12} /> Impersonation активен
                                <button type="button" onClick={onStopImpersonating} className="ml-1 underline-offset-2 hover:underline">
                                    остановить
                                </button>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <ModeToggle />
                        {currentUser && <NotificationsBell currentUser={currentUser} />}

                        {currentUser ? (
                            <div ref={userMenuRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setUserMenuOpen((open) => !open)}
                                    className="flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 py-1 text-sm hover:border-primary"
                                >
                                    <UserAvatar user={currentUser} size="sm" />
                                    <span className="hidden max-w-[140px] truncate font-semibold sm:inline">{currentUser.name || currentUser.email}</span>
                                    <ChevronDown size={14} className="text-muted-foreground" />
                                </button>
                                {userMenuOpen && (
                                    <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                                        <div className="border-b border-border px-4 py-3">
                                            <p className="truncate text-sm font-semibold">{currentUser.name || "Пользователь"}</p>
                                            <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
                                            {hasElevatedUserAccess(currentUser, adminContext) && (
                                                <p className="mt-1 text-xs text-muted-foreground">Роль: <span className="text-foreground">{displayRoleText(currentUser, adminContext)}</span></p>
                                            )}
                                        </div>
                                        <NavLink
                                            to="/profile"
                                            onClick={() => setUserMenuOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted"
                                        >
                                            <UserIcon size={14} /> Профиль
                                        </NavLink>
                                        <NavLink
                                            to="/profile/settings"
                                            onClick={() => setUserMenuOpen(false)}
                                            className="flex items-center gap-2 border-t border-border px-4 py-2 text-sm hover:bg-muted"
                                        >
                                            <Settings size={14} /> Настройки
                                        </NavLink>
                                        <button
                                            type="button"
                                            onClick={async () => { setUserMenuOpen(false); await onLogout(); }}
                                            className="flex w-full items-center gap-2 border-t border-border px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                                        >
                                            <LogOut size={14} /> Выйти
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={onOpenAuthModal}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                            >
                                <LogIn size={14} /> Войти
                            </button>
                        )}
                    </div>
                </header>

                {/* Content */}
                <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
                    <Suspense fallback={<RoutePageSkeleton pathname={location.pathname} />}>
                        <Outlet />
                    </Suspense>
                </main>

                {/* Footer */}
                <footer className="mx-auto mt-8 flex w-full max-w-[1400px] flex-col items-start justify-between gap-3 border-t border-border px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6 lg:px-8">
                    <p>© {new Date().getFullYear()} RF4 Community · сообщество фанатов Russian Fishing 4</p>
                    <nav className="flex flex-wrap gap-x-4 gap-y-1">
                        <NavLink to="/legal/privacy" className="hover:text-primary">Конфиденциальность</NavLink>
                        <NavLink to="/legal/terms" className="hover:text-primary">Соглашение</NavLink>
                        <NavLink to="/legal/rules" className="hover:text-primary">Правила</NavLink>
                        <span>Игровые данные принадлежат <a href="https://rf4game.com">rf4game.com</a></span>
                    </nav>
                </footer>
            </div>
        </div>
    );
}
