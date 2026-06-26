import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Mail, Newspaper, Settings, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { UserAvatar } from "../components/UserAvatar";
import { getAuthorProfile } from "../lib/posts-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import { displayRoleText, formatDate, getErrorMessage } from "../utils/admin-format";
import { MyPostsPage } from "./MyPostsPage";

type Props = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onSessionRefresh: () => Promise<void>;
    onOpenAuthModal: () => void;
};

type Stats = { postCount: number; totalIncome: number; createdAt: string | null };

// Public-facing profile: identity + activity stats + own posts. Editing lives at /profile/settings.
// onSessionRefresh is kept in the props signature for API parity with the older combined page;
// nothing on this view triggers a session refresh.
export function ProfilePage({ currentUser, adminContext, onOpenAuthModal }: Props) {
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) return;
        let cancelled = false;
        getAuthorProfile(currentUser.id, { limit: 1 })
            .then((response) => {
                if (cancelled) return;
                setStats({
                    postCount: response.stats.postCount,
                    totalIncome: response.stats.totalIncome,
                    createdAt: response.author.createdAt ?? null,
                });
            })
            .catch((caught) => { if (!cancelled) setStatsError(getErrorMessage(caught)); });
        return () => { cancelled = true; };
    }, [currentUser?.id]);

    if (!currentUser) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Профиль" title="Доступ ограничен" description="Войдите, чтобы увидеть свой профиль." />
                <button className="primary justify-self-start" onClick={onOpenAuthModal}>
                    Войти / Зарегистрироваться
                </button>
            </section>
        );
    }

    return (
        <section className="grid gap-6">
            <PageHeader
                eyebrow="Профиль"
                title={currentUser.name || currentUser.email || "Профиль"}
                description="Публичная карточка автора, статистика и ваши посты."
                actions={
                    <Link
                        to="/profile/settings"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
                    >
                        <Settings size={15} /> Настройки
                    </Link>
                }
            />

            {/* Identity card */}
            <article className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <UserAvatar user={currentUser} size="lg" />
                    <div className="grid gap-1">
                        <h3 className="text-xl font-bold">{currentUser.name || "Без имени"}</h3>
                        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail size={13} /> {currentUser.email}
                            {currentUser.emailVerified ? (
                                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                                    <ShieldCheck size={10} /> подтверждён
                                </span>
                            ) : (
                                <span className="ml-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                                    не подтверждён
                                </span>
                            )}
                        </p>
                        <p className="text-xs text-muted-foreground">Роль: <span className="text-foreground">{displayRoleText(currentUser, adminContext)}</span></p>
                    </div>
                </div>
            </article>

            {/* Stats */}
            <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                    icon={Newspaper}
                    label="Опубликовано постов"
                    value={stats ? stats.postCount.toLocaleString("ru-RU") : "—"}
                />
                <StatTile
                    icon={Wallet}
                    label="Заработано (серебро)"
                    value={stats ? stats.totalIncome.toLocaleString("ru-RU") : "—"}
                />
                <StatTile
                    icon={CalendarDays}
                    label="С нами с"
                    value={stats?.createdAt ? formatDate(stats.createdAt) : "—"}
                />
            </div>
            {statsError && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{statsError}</p>}

            {/* Own posts */}
            <div className="grid gap-3">
                <MyPostsPage currentUser={currentUser} onOpenAuthModal={onOpenAuthModal} />
            </div>
        </section>
    );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Newspaper; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon size={18} />
            </span>
            <div className="grid leading-tight">
                <span className="text-xs text-muted-foreground">{label}</span>
                <strong className="text-lg tabular-nums">{value}</strong>
            </div>
        </div>
    );
}
