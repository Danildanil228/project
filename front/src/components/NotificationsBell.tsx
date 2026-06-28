import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getNotificationSoundSettings,
    listNotifications,
    markNotificationsRead,
    notificationsUnreadCount,
    subscribeToNotificationEvents,
} from "../lib/engagement-api";
import type { ManagedUser } from "../types/admin";
import type { NotificationRow, NotificationType } from "../types/post";
import { formatDate } from "../utils/admin-format";
import { postMapLinkingEnabled } from "../lib/features";
import { installNotificationAudioUnlock, notificationSoundSettingsEvent, playNotificationSound } from "../lib/notification-sound";
import { defaultNotificationSoundSettings, type NotificationSoundSettings } from "../types/notification-sound";
import { ListSkeleton } from "./LoadingState";

type NotificationsBellProps = {
    currentUser?: ManagedUser;
};

function describe(notification: NotificationRow): string {
    const actor = notification.actorName || "Пользователь";
    const labels: Record<NotificationType, string> = {
        comment: `${actor} прокомментировал ваш пост`,
        post_approved: "Ваш пост одобрен и опубликован",
        post_rejected: "Ваш пост отклонён",
        post_removed: "Ваш пост удалён модератором",
        moderation_new: "Новый пост ожидает модерации",
        report_new: "Новая жалоба на пост",
        map_submission_new: "Новая точка ожидает проверки",
        map_submission_approved: "Ваша точка опубликована на карте",
        map_submission_rejected: "Ваша точка отклонена",
    };
    return labels[notification.type] ?? "Уведомление";
}

function extra(notification: NotificationRow): string | null {
    const data = notification.data ?? {};
    if (notification.type === "comment" && typeof data.snippet === "string") return data.snippet;
    if (notification.type === "post_rejected" && typeof data.reason === "string") return `Причина: ${data.reason}`;
    if (notification.type === "report_new" && typeof data.reason === "string") return data.reason;
    if (notification.type === "map_submission_rejected" && typeof data.reason === "string") return `Причина: ${data.reason}`;
    return null;
}

export function NotificationsBell({ currentUser }: NotificationsBellProps) {
    const navigate = useNavigate();
    const currentUserId = currentUser?.id;
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [items, setItems] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const latestUnreadIdRef = useRef<number | null | undefined>(undefined);
    const soundSettingsRef = useRef<NotificationSoundSettings>(defaultNotificationSoundSettings);

    const refreshCount = useCallback(() => {
        if (!currentUserId) return;
        notificationsUnreadCount()
            .then(({ unread: value, latestId }) => {
                const previousLatestId = latestUnreadIdRef.current;
                if (previousLatestId !== undefined && latestId !== null && (previousLatestId === null || latestId > previousLatestId)) {
                    void playNotificationSound(soundSettingsRef.current);
                }
                latestUnreadIdRef.current = latestId;
                setUnread(value);
            })
            .catch(() => undefined);
    }, [currentUserId]);

    useEffect(() => {
        latestUnreadIdRef.current = undefined;
        soundSettingsRef.current = defaultNotificationSoundSettings;
        installNotificationAudioUnlock();
        if (currentUserId) {
            getNotificationSoundSettings()
                .then((settings) => { soundSettingsRef.current = settings; })
                .catch(() => undefined);
        }
        const onSettingsChanged = (event: Event) => {
            soundSettingsRef.current = (event as CustomEvent<NotificationSoundSettings>).detail;
        };
        window.addEventListener(notificationSoundSettingsEvent, onSettingsChanged);
        return () => window.removeEventListener(notificationSoundSettingsEvent, onSettingsChanged);
    }, [currentUserId]);

    useEffect(() => {
        refreshCount();
        if (!currentUserId) return;
        const unsubscribe = subscribeToNotificationEvents(refreshCount, refreshCount);
        const timer = window.setInterval(refreshCount, 60_000);
        return () => {
            unsubscribe();
            window.clearInterval(timer);
        };
    }, [currentUserId, refreshCount]);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    async function toggleOpen() {
        const next = !open;
        setOpen(next);
        if (next) {
            setLoading(true);
            try {
                const response = await listNotifications({ limit: 20 });
                setItems(response.items);
            } catch {
                setItems([]);
            } finally {
                setLoading(false);
            }
        }
    }

    async function markAll() {
        try {
            const { unread: value } = await markNotificationsRead();
            setUnread(value);
            setItems((previous) => previous.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
        } catch {
            /* ignore */
        }
    }

    async function openNotification(notification: NotificationRow) {
        setOpen(false);
        if (!notification.readAt) {
            markNotificationsRead([notification.id])
                .then(({ unread: value }) => setUnread(value))
                .catch(() => undefined);
        }
        if (notification.type === "report_new") {
            navigate("/moderation/reports");
        } else if (postMapLinkingEnabled && notification.type === "map_submission_new") {
            navigate("/moderation/map");
        } else if (notification.type === "moderation_new") {
            navigate("/moderation");
        } else if (notification.postId) {
            navigate(`/posts/${notification.postId}`);
        }
    }

    if (!currentUser) return null;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={toggleOpen}
                aria-label="Уведомления"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:border-primary"
            >
                <span className="text-lg">🔔</span>
                {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="fixed inset-x-3 top-16 z-30 max-h-[calc(100vh-5rem)] overflow-hidden rounded-lg border border-border bg-card shadow-lg sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-80 sm:max-w-[90vw]">
                    <div className="flex items-center justify-between border-b border-border p-2">
                        <span className="text-sm font-bold">Уведомления</span>
                        {unread > 0 && (
                            <button type="button" onClick={markAll} className="text-xs text-primary hover:underline">
                                Прочитать все
                            </button>
                        )}
                    </div>
                    <div className="max-h-[calc(100vh-9rem)] overflow-y-auto sm:max-h-96">
                        {loading ? (
                            <div className="p-2"><ListSkeleton count={4} /></div>
                        ) : items.length === 0 ? (
                            <p className="p-4 text-center text-sm text-muted-foreground">Уведомлений нет</p>
                        ) : (
                            items.map((notification) => {
                                const note = extra(notification);
                                return (
                                    <button
                                        key={notification.id}
                                        type="button"
                                        onClick={() => openNotification(notification)}
                                        className={`block w-full border-b border-border p-3 text-left last:border-b-0 hover:bg-muted ${
                                            notification.readAt ? "" : "bg-primary/5"
                                        }`}
                                    >
                                        <p className="text-sm font-medium">{describe(notification)}</p>
                                        {note && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{note}</p>}
                                        <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(notification.createdAt)}</p>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
