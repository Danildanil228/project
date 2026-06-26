import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuditLogPanel } from "../features/admin/AuditLogPanel";
import { PageHeader } from "../components/PageHeader";
import { exportAuditLogsCsv, listAuditLogs } from "../lib/admin-api";
import type { AdminSecurityContext, AuditLogFilters, ManagedAuditLog, ManagedUser } from "../types/admin";
import { getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type Props = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
};

const PAGE_SIZE = 30;
const EMPTY_FILTERS: AuditLogFilters = {
    actorEmail: "",
    targetEmail: "",
    action: "",
    outcome: "",
    from: "",
    to: "",
};

// Audit log page — same control surface as the panel previously embedded in /admin, just
// lifted into its own route so the user-management screen stops being two unrelated panels stacked.
export function AdminAuditPage({ currentUser, adminContext, onOpenAuthModal }: Props) {
    const elevated = hasElevatedUserAccess(currentUser, adminContext);

    const [logs, setLogs] = useState<ManagedAuditLog[]>([]);
    const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_FILTERS);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function loadAuditLogs(nextOffset = offset, nextFilters = filters) {
        setLoading(true); setError("");
        try {
            const response = await listAuditLogs({ limit: PAGE_SIZE, offset: nextOffset, ...nextFilters });
            setLogs(response.logs ?? []);
            setTotal(response.total ?? 0);
            setOffset(nextOffset);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }

    async function exportCsv() {
        setError(""); setNotice("");
        try {
            const blob = await exportAuditLogsCsv({ ...filters, limit: 5000 });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `audit-logs-export-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.append(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setNotice("CSV журнала подготовлен");
        } catch (caught) {
            setError(getErrorMessage(caught));
        }
    }

    function resetFilters() {
        setFilters(EMPTY_FILTERS);
        void loadAuditLogs(0, EMPTY_FILTERS);
    }

    useEffect(() => {
        if (!elevated) return;
        void loadAuditLogs(0, EMPTY_FILTERS);
        // Mount-only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [elevated]);

    if (!currentUser) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Админ" title="Требуется вход" />
                <button className="primary justify-self-start" onClick={onOpenAuthModal}>Войти</button>
            </section>
        );
    }
    if (!elevated) {
        return (
            <section className="grid gap-5">
                <PageHeader eyebrow="Админ" title="Нет доступа" description="Для журнала аудита нужна роль admin или moderator." />
            </section>
        );
    }

    return (
        <section className="grid gap-5">
            <PageHeader
                eyebrow="Админ"
                title="Журнал действий"
                description="Что и когда меняли модераторы и админы. Доступен экспорт CSV."
                actions={
                    <Link to="/admin" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:border-primary">
                        <ArrowLeft size={14} /> К сводке
                    </Link>
                }
            />

            {notice && <p className="alert success text-xs">{notice}</p>}
            {error && <p className="alert error text-xs">{error}</p>}

            <AuditLogPanel
                logs={logs}
                filters={filters}
                total={total}
                offset={offset}
                pageSize={PAGE_SIZE}
                loading={loading}
                onFiltersChange={setFilters}
                onRefresh={() => loadAuditLogs(offset)}
                onApplyFilters={() => loadAuditLogs(0)}
                onResetFilters={resetFilters}
                onPageChange={(nextOffset) => loadAuditLogs(nextOffset)}
                onExportCsv={exportCsv}
            />
        </section>
    );
}
