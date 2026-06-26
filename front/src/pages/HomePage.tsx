import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Crown, Fish, Map as MapIcon, Newspaper, PenSquare, User as UserIcon } from "lucide-react";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { hasElevatedUserAccess } from "../utils/admin-format";

type HomePageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

type ActionCard = {
    to: string;
    icon: typeof Fish;
    title: string;
    description: string;
    accent?: boolean;
};

export function HomePage({ currentUser, adminContext, onOpenAuthModal }: HomePageProps) {
    const canOpenAdmin = hasElevatedUserAccess(currentUser, adminContext);
    const name = currentUser?.name?.split(" ")[0] || currentUser?.email?.split("@")[0];

    const actions: ActionCard[] = [
        { to: "/feed", icon: Newspaper, title: "Лента", description: "Последние уловы сообщества" },
        { to: "/catalog", icon: BookOpen, title: "Каталог", description: "Катушки, удилища, характеристики" },
        { to: "/waterbodies", icon: MapIcon, title: "Водоёмы", description: "Карты, точки клёва, маршруты" },
        currentUser
            ? { to: "/posts/new", icon: PenSquare, title: "Новый пост", description: "Поделиться уловом", accent: true }
            : { to: "/profile", icon: UserIcon, title: "Профиль", description: "Войти, чтобы публиковать" },
    ];

    return (
        <div className="grid gap-8">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary via-primary to-[oklch(0.35_0.10_240)] p-6 text-primary-foreground shadow-lg sm:p-10">
                {/* Decorative wave layers */}
                <svg
                    aria-hidden
                    viewBox="0 0 1200 240"
                    className="pointer-events-none absolute -bottom-1 left-0 right-0 w-full opacity-25"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M0 140 C 200 80, 400 200, 600 140 C 800 80, 1000 200, 1200 140 L 1200 240 L 0 240 Z"
                        fill="currentColor"
                        className="text-primary-foreground"
                    />
                    <path
                        d="M0 180 C 200 130, 400 230, 600 180 C 800 130, 1000 230, 1200 180 L 1200 240 L 0 240 Z"
                        fill="currentColor"
                        className="text-primary-foreground/60"
                    />
                </svg>
                <div className="relative grid gap-4 sm:max-w-2xl">
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
                        <Fish size={12} /> RF4 Community
                    </span>
                    <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                        {currentUser ? <>Привет, {name} 👋</> : <>Дневник твоей рыбалки в Russian Fishing 4</>}
                    </h1>
                    <p className="max-w-xl text-base text-primary-foreground/85 sm:text-lg">
                        Ленты уловов, карты водоёмов, каталог снастей с 3D-моделями. Делись опытом — и читай чужой.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {currentUser ? (
                            <Link
                                to="/posts/new"
                                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow transition hover:brightness-105"
                            >
                                <PenSquare size={16} /> Опубликовать улов
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={onOpenAuthModal}
                                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow transition hover:brightness-105"
                            >
                                Войти / Зарегистрироваться <ArrowRight size={16} />
                            </button>
                        )}
                        <Link
                            to="/feed"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20 text-primary-foreground"
                        >
                            <Newspaper size={16} /> Открыть ленту
                        </Link>
                    </div>
                </div>
            </section>

            {/* Quick action grid */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {actions.map(({ to, icon: Icon, title, description, accent }) => (
                    <Link
                        key={to}
                        to={to}
                        className={`group relative grid gap-3 rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                            accent
                                ? "border-accent/40 bg-accent/10 hover:border-accent"
                                : "border-border bg-card hover:border-primary"
                        }`}
                    >
                        <span
                            className={`grid size-10 place-items-center rounded-xl ${
                                accent ? "bg-accent text-accent-foreground" : "bg-primary-soft text-primary"
                            }`}
                        >
                            <Icon size={18} />
                        </span>
                        <div className="grid gap-0.5">
                            <h3 className="text-base font-semibold">{title}</h3>
                            <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                        <ArrowRight
                            size={16}
                            className="absolute right-4 top-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                        />
                    </Link>
                ))}
            </section>

            {/* Features / explainer */}
            <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:p-8">
                <div className="grid gap-1">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-primary">О проекте</p>
                    <h2 className="text-2xl font-bold">Что внутри</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <FeatureBlock
                        icon={Newspaper}
                        title="Лента уловов"
                        text="Посты с фотографиями, точками на карте, информацией о снасти и наживке. Реакции, комментарии, репорты."
                    />
                    <FeatureBlock
                        icon={MapIcon}
                        title="Карты водоёмов"
                        text="Интерактивные карты. Точки клёва от сообщества, маршруты троллинга, проверенные места."
                    />
                    <FeatureBlock
                        icon={BookOpen}
                        title="Каталог снастей"
                        text="Катушки и удилища с полными характеристиками. 3D-просмотр моделей, сортировка, фильтры."
                    />
                </div>
            </section>

            {/* Admin entry, only when user has it */}
            {canOpenAdmin && (
                <section className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
                    <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-primary">Для администратора</p>
                        <h3 className="mt-1 text-lg font-bold">Управление проектом</h3>
                        <p className="mt-1 max-w-md text-sm text-muted-foreground">
                            Пользователи, модерация постов, справочники, журнал аудита.
                        </p>
                    </div>
                    <Link
                        to="/admin"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
                    >
                        <Crown size={16} /> Открыть админку
                    </Link>
                </section>
            )}
        </div>
    );
}

function FeatureBlock({ icon: Icon, title, text }: { icon: typeof Fish; title: string; text: string }) {
    return (
        <div className="grid gap-2">
            <div className="flex gap-3 items-center">
                <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Icon size={16} />
                </span>
                <h3 className="text-base font-semibold">{title}</h3>
            </div>
            
            
            <p className="text-sm text-muted-foreground">{text}</p>
        </div>
    );
}
