import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    ArrowRight,
    Database,
    FileText,
    Mail,
    ShieldOff,
    UserMinus,
    UserPlus,
    Users,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { getAdminOverviewData, type AdminOverview } from "../lib/admin-api";
import type { AdminSecurityContext, ManagedAuditLog, ManagedUser } from "../types/admin";
import { auditActionText, auditSummary } from "../utils/audit-format";
import { canManageCatalog, formatDate, getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type Props = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

// Read-only overview page: counts + recent admin activity + jumps into the deeper admin sub-pages.
// All numbers come from /api/admin/overview, which itself is one round-trip with four COUNTs.
export function AdminOverviewPage({ currentUser, adminContext, onOpenAuthModal }: Props) {
    const elevated = hasElevatedUserAccess(currentUser, adminContext);
    const catalogAdmin = canManageCatalog(currentUser, adminContext);

    const [data, setData] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!elevated) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true); setError("");
        getAdminOverviewData()
            .then((value) => { if (!cancelled) setData(value); })
            .catch((caught) => { if (!cancelled) setError(getErrorMessage(caught)); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [elevated]);

    if (!currentUser) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Админ" title="Требуется вход" description="Войдите, чтобы открыть админ-панель." />
                <button className="primary justify-self-start" onClick={onOpenAuthModal}>Войти</button>
            </section>
        );
    }
    if (!elevated) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Админ" title="Нет доступа" description="Для админ-панели нужна роль admin или moderator." />
            </section>
        );
    }

    return (
        <section className="grid gap-6">
            <PageHeader
                eyebrow="Админ"
                title="Сводка"
                description="Ключевые показатели и последние действия модераторов."
                actions={
                    <Link
                        to="/admin/users"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
                    >
                        <Users size={15} /> Пользователи
                    </Link>
                }
            />

            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile icon={Users} label="Всего пользователей" value={fmt(data?.counts.total)} loading={loading} />
                <StatTile icon={UserPlus} label="Новые за 30 дней" value={fmt(data?.counts.newLast30Days)} accent loading={loading} />
                <StatTile icon={Mail} label="Email не подтверждён" value={fmt(data?.counts.unverified)} warn={(data?.counts.unverified ?? 0) > 0} loading={loading} />
                <StatTile icon={UserMinus} label="Заблокировано" value={fmt(data?.counts.banned)} danger={(data?.counts.banned ?? 0) > 0} loading={loading} />
            </div>

            {/* Quick-links to the rest of admin */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <QuickLink to="/admin/users" icon={Users} title="Пользователи" subtitle="Список, фильтры, действия" />
                <QuickLink to="/admin/audit" icon={FileText} title="Журнал" subtitle="Аудит действий" />
                <QuickLink to="/moderation" icon={ShieldOff} title="Очередь" subtitle="Посты на проверке" />
                {catalogAdmin && <QuickLink to="/admin/reference" icon={Database} title="Справочники" subtitle="Каталог и точки" />}
            </div>

            {/* Recent activity */}
            <article className="grid gap-3 rounded-2xl border border-border bg-card p-5">
                <header className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary"><Activity size={16} /></span>
                        <h3 className="text-base font-bold">Последние действия модераторов</h3>
                    </div>
                    <Link to="/admin/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        Весь журнал <ArrowRight size={12} />
                    </Link>
                </header>

                {loading ? (
                    <p className="text-sm text-muted-foreground">Загрузка…</p>
                ) : !data || data.recentActions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Действий пока нет.</p>
                ) : (
                    <ul className="grid divide-y divide-border">
                        {data.recentActions.map((entry) => (
                            <RecentRow key={entry.id} entry={entry} />
                        ))}
                    </ul>
                )}
            </article>
        </section>
    );
}

function fmt(value: number | undefined): string {
    return value == null ? "—" : value.toLocaleString("ru-RU");
}

function StatTile({ icon: Icon, label, value, loading, accent, warn, danger }: { icon: typeof Users; label: string; value: string; loading?: boolean; accent?: boolean; warn?: boolean; danger?: boolean }) {
    const tone = danger
        ? "bg-destructive/10 text-destructive"
        : warn
            ? "bg-accent/15 text-accent-foreground"
            : accent
                ? "bg-accent text-accent-foreground"
                : "bg-primary-soft text-primary";
    return (
        <div className="grid gap-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
                <span className={`grid size-9 place-items-center rounded-lg ${tone}`}><Icon size={16} /></span>
                {loading && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">…</span>}
            </div>
            <div className="grid leading-tight">
                <strong className="text-2xl tabular-nums">{value}</strong>
                <span className="text-xs text-muted-foreground">{label}</span>
            </div>
        </div>
    );
}

function QuickLink({ to, icon: Icon, title, subtitle }: { to: string; icon: typeof Users; title: string; subtitle: string }) {
    return (
        <Link
            to={to}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
        >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon size={18} />
            </span>
            <div className="grid leading-tight">
                <strong className="text-sm">{title}</strong>
                <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
            <ArrowRight size={16} className="ml-auto text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
    );
}

function RecentRow({ entry }: { entry: ManagedAuditLog }) {
    const isFailure = entry.outcome === "failure";
    return (
        <li className="grid gap-1 py-3">
            <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 gap-0.5">
                    <strong className="truncate text-sm">{auditActionText(entry.action)}</strong>
                    <span className="truncate text-xs text-muted-foreground">{auditSummary(entry)}</span>
                </div>
                <time className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isFailure ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {isFailure ? "fail" : "ok"} · {formatDate(entry.createdAt)}
                </time>
            </div>
        </li>
    );
}
