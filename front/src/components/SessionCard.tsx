import { CalendarDays, Clock3, Globe2, LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import type { ManagedSession } from "../types/admin";
import { formatDate } from "../utils/admin-format";
import { sessionClientInfo, type SessionDeviceType } from "../utils/session-display";

type Props = {
    session: ManagedSession;
    isCurrent?: boolean;
    disabled?: boolean;
    onRevoke?: (token: string) => void;
};

function DeviceIcon({ type }: { type: SessionDeviceType }) {
    if (type === "mobile") return <Smartphone size={20} />;
    if (type === "tablet") return <Tablet size={20} />;
    return <Monitor size={20} />;
}

export function SessionCard({ session, isCurrent = false, disabled = false, onRevoke }: Props) {
    const client = sessionClientInfo(session.userAgent);

    return (
        <article className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid min-w-0 gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                        <DeviceIcon type={client.deviceType} />
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <strong className="truncate text-sm" title={client.title}>{client.title}</strong>
                            {isCurrent && (
                                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                                    Текущая сессия
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {isCurrent ? "Это устройство используется сейчас" : "Аккаунт открыт на другом устройстве или в другом браузере"}
                        </p>
                    </div>
                </div>

                <dl className="grid gap-3 text-xs sm:grid-cols-3">
                    <div className="grid gap-1">
                        <dt className="flex items-center gap-1.5 text-muted-foreground"><Globe2 size={13} /> IP-адрес</dt>
                        <dd className="font-medium text-foreground">{session.ipAddress || "Не определён"}</dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays size={13} /> Начало сессии</dt>
                        <dd className="font-medium text-foreground">{formatDate(session.createdAt)}</dd>
                    </div>
                    <div className="grid gap-1">
                        <dt className="flex items-center gap-1.5 text-muted-foreground"><Clock3 size={13} /> Действует до</dt>
                        <dd className="font-medium text-foreground">{formatDate(session.expiresAt)}</dd>
                    </div>
                </dl>
            </div>

            {!isCurrent && onRevoke && (
                <button className="secondary inline-flex items-center justify-center gap-2" type="button" onClick={() => onRevoke(session.token)} disabled={disabled}>
                    <LogOut size={14} /> Завершить
                </button>
            )}
        </article>
    );
}
