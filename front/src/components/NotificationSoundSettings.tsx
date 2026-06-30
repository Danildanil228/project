import { useEffect, useState, type ChangeEvent } from "react";
import { Loader2, Play, Trash2, Upload, Volume2, VolumeX } from "lucide-react";
import {
    deleteNotificationSound,
    getNotificationSoundSettings,
    updateNotificationSoundSettings,
    uploadNotificationSound,
} from "../lib/engagement-api";
import {
    announceNotificationSoundSettings,
    notificationSoundOptions,
    playNotificationSound,
} from "../lib/notification-sound";
import { defaultNotificationSoundSettings, type NotificationSoundKey, type NotificationSoundSettings as Settings } from "../types/notification-sound";
import { getErrorMessage } from "../utils/admin-format";
import { RangeControl } from "./RangeControl";
import { Skeleton } from "./LoadingState";

const maxSoundBytes = 2 * 1024 * 1024;

export function NotificationSoundSettings() {
    const [settings, setSettings] = useState<Settings>(defaultNotificationSoundSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let ignore = false;
        getNotificationSoundSettings()
            .then((response) => { if (!ignore) setSettings(response); })
            .catch((caught) => { if (!ignore) setError(getErrorMessage(caught)); })
            .finally(() => { if (!ignore) setLoading(false); });
        return () => { ignore = true; };
    }, []);

    function apply(next: Settings) {
        setSettings(next);
        announceNotificationSoundSettings(next);
    }

    async function save() {
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const next = await updateNotificationSoundSettings(settings);
            apply(next);
            setNotice("Настройки звука сохранены");
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setSaving(false);
        }
    }

    async function upload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > maxSoundBytes) {
            setError("Файл больше 2 МБ");
            return;
        }
        setUploading(true);
        setError("");
        setNotice("");
        try {
            const next = await uploadNotificationSound(file);
            apply(next);
            setNotice("Собственный звук загружен и выбран");
            await playNotificationSound(next, true);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setUploading(false);
        }
    }

    async function removeCustom() {
        if (!window.confirm("Удалить загруженный звук?")) return;
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const next = await deleteNotificationSound();
            apply(next);
            setNotice("Собственный звук удалён");
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setSaving(false);
        }
    }

    function choose(sound: NotificationSoundKey) {
        setSettings((current) => ({ ...current, sound }));
    }

    function preview(sound: NotificationSoundKey) {
        void playNotificationSound({ ...settings, enabled: true, sound }, true);
    }

    if (loading) return (
        <section className="panel grid gap-4" aria-busy="true">
            <div className="flex items-start justify-between gap-3"><div className="grid flex-1 gap-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-80 max-w-full" /></div><Skeleton className="h-10 w-36" /></div>
            <div className="overflow-hidden rounded-lg border border-border">{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex items-center gap-3 border-b border-border p-3 last:border-0"><Skeleton className="size-4 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-56 max-w-full" /></div><Skeleton className="size-9" /></div>)}</div>
            <Skeleton className="h-12 w-full" />
            <div className="flex justify-between gap-3"><Skeleton className="h-10 w-44" /><Skeleton className="h-10 w-28" /></div>
        </section>
    );

    return (
        <section className="panel settings-card" data-testid="notification-sound-settings">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold"><Volume2 size={18} /> Звук уведомлений</h2>
                    <p className="muted text-sm">Сигнал прозвучит только при появлении нового уведомления.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, enabled: !current.enabled }))}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${settings.enabled ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                    aria-pressed={settings.enabled}
                >
                    {settings.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    {settings.enabled ? "Звук включён" : "Звук выключен"}
                </button>
            </div>

            {notice && <p className="alert success text-sm">{notice}</p>}
            {error && <p className="alert error text-sm">{error}</p>}

            <div className="overflow-hidden rounded-lg border border-border">
                {notificationSoundOptions.map((option) => (
                    <div key={option.key} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 hover:bg-muted/50">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                            <input type="radio" name="notification-sound" checked={settings.sound === option.key} onChange={() => choose(option.key)} />
                            <span className="min-w-0 flex-1">
                                <strong className="block text-sm">{option.name}</strong>
                                <span className="block text-xs text-muted-foreground">{option.description}</span>
                            </span>
                        </label>
                        <button type="button" onClick={(event) => { event.preventDefault(); preview(option.key); }} title={`Прослушать: ${option.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-border hover:border-primary"><Play size={15} /></button>
                    </div>
                ))}
                {settings.customUrl && (
                    <div className="flex items-center gap-3 border-t border-border px-3 py-3 hover:bg-muted/50">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                            <input type="radio" name="notification-sound" checked={settings.sound === "custom"} onChange={() => choose("custom")} />
                            <span className="min-w-0 flex-1">
                                <strong className="block text-sm">Собственный звук</strong>
                                <span className="block text-xs text-muted-foreground">Загруженный вами файл</span>
                            </span>
                        </label>
                        <button type="button" onClick={(event) => { event.preventDefault(); preview("custom"); }} title="Прослушать свой звук" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border hover:border-primary"><Play size={15} /></button>
                        <button type="button" onClick={(event) => { event.preventDefault(); void removeCustom(); }} title="Удалить свой звук" className="grid size-9 shrink-0 place-items-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 size={15} /></button>
                    </div>
                )}
            </div>

            <RangeControl
                label="Громкость"
                value={Math.round(settings.volume * 100)}
                valueLabel={`${Math.round(settings.volume * 100)}%`}
                step={5}
                onChange={(volume) => setSettings((current) => ({ ...current, volume: volume / 100 }))}
            />

            <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? "Загрузка…" : settings.customUrl ? "Заменить свой звук" : "Загрузить свой звук"}
                    <input type="file" accept=".mp3,.wav,.ogg,.webm,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4" disabled={uploading} onChange={upload} className="sr-only" />
                </label>
                <span className="text-xs text-muted-foreground">MP3, WAV, OGG, WebM или M4A, до 2 МБ</span>
                <button type="button" onClick={() => void save()} disabled={saving || uploading} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    {saving && <Loader2 size={15} className="animate-spin" />} Сохранить
                </button>
            </div>
        </section>
    );
}
