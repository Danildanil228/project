import { Check, ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MultiCombobox } from "../components/MultiCombobox";
import { PostLocationPicker, type PostLocationValue } from "../components/PostLocationPicker";
import { approveMapSubmission, listMapSubmissions, rejectMapSubmission } from "../lib/map-submissions-api";
import { getWaterbody, listBaits } from "../lib/reference-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { Bait } from "../types/bait";
import type { MapSubmission, MapSubmissionStatus } from "../types/map-submission";
import type { Waterbody } from "../types/waterbody";
import { formatDate, getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type Props = { currentUser?: ManagedUser; adminContext?: AdminSecurityContext | null; onOpenAuthModal: () => void };
type TargetDraft = { fishId: number; baitIds: number[] };

const statuses: Array<{ value: MapSubmissionStatus; label: string }> = [
    { value: "pending", label: "Ожидают" },
    { value: "approved", label: "Одобрены" },
    { value: "rejected", label: "Отклонены" },
];

export function MapModerationPage({ currentUser, adminContext, onOpenAuthModal }: Props) {
    const canModerate = hasElevatedUserAccess(currentUser, adminContext);
    const [status, setStatus] = useState<MapSubmissionStatus>("pending");
    const [items, setItems] = useState<MapSubmission[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [waterbody, setWaterbody] = useState<Waterbody | null>(null);
    const [baits, setBaits] = useState<Bait[]>([]);
    const [location, setLocation] = useState<PostLocationValue>({ proposedSpotId: null, mapX: null, mapY: null, gameCoordinateX: null, gameCoordinateY: null, mapX2: null, mapY2: null, gameCoordinateX2: null, gameCoordinateY2: null });
    const [name, setName] = useState("");
    const [targets, setTargets] = useState<TargetDraft[]>([]);
    const [rejectReason, setRejectReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

    const load = useCallback(async () => {
        if (!canModerate) return;
        setLoading(true);
        setError("");
        try {
            const response = await listMapSubmissions({ status });
            setItems(response.items);
            setSelectedId((current) => response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null);
        } catch (caught) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    }, [canModerate, status]);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (!selected) { setWaterbody(null); return; }
        let ignore = false;
        Promise.all([getWaterbody(selected.waterbodyId), listBaits({ limit: 500 })])
            .then(([water, baitResponse]) => {
                if (ignore) return;
                setWaterbody(water.item);
                setBaits(baitResponse.items);
                setName(`Точка ${selected.gameCoordinateX}:${selected.gameCoordinateY}`);
                setLocation({ proposedSpotId: selected.proposedSpotId, mapX: selected.mapX, mapY: selected.mapY, gameCoordinateX: selected.gameCoordinateX, gameCoordinateY: selected.gameCoordinateY, mapX2: null, mapY2: null, gameCoordinateX2: null, gameCoordinateY2: null });
                setTargets(selected.targets.map((target) => ({ fishId: target.fishId, baitIds: target.baits.map((bait) => bait.id) })));
                setRejectReason("");
            })
            .catch((caught) => { if (!ignore) setError(getErrorMessage(caught)); });
        return () => { ignore = true; };
    }, [selected]);

    const fishOptions = useMemo(() => waterbody?.fish.map((fish) => ({ id: fish.id, name: fish.name, hint: fish.rarity })) ?? [], [waterbody]);
    const baitOptions = useMemo(() => baits.map((bait) => ({ id: bait.id, name: bait.name, hint: bait.kind })), [baits]);
    const targetIds = targets.map((target) => target.fishId);
    const isOwn = selected?.authorId === currentUser?.id;

    function changeTargetFish(ids: number[]) {
        setTargets(ids.map((fishId) => targets.find((target) => target.fishId === fishId) ?? { fishId, baitIds: [] }));
    }

    async function approve() {
        if (!selected || location.mapX === null || location.mapY === null || location.gameCoordinateX === null || location.gameCoordinateY === null) return setError("Укажите точку на карте");
        if (!location.proposedSpotId && !name.trim()) return setError("Укажите название новой точки");
        if (!targets.length) return setError("Добавьте хотя бы одну рыбу");
        setBusy(true); setError(""); setNotice("");
        try {
            await approveMapSubmission(selected.id, { spotId: location.proposedSpotId, name: name.trim() || "Точка ловли", mapX: location.mapX, mapY: location.mapY, gameCoordinateX: location.gameCoordinateX, gameCoordinateY: location.gameCoordinateY, targets });
            setNotice("Точка опубликована на карте");
            await load();
        } catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
    }

    async function reject() {
        if (!selected || !rejectReason.trim()) return setError("Укажите причину отклонения");
        setBusy(true); setError(""); setNotice("");
        try { await rejectMapSubmission(selected.id, rejectReason.trim()); setNotice("Заявка отклонена"); await load(); }
        catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); }
    }

    if (!canModerate) return <section className="rounded-lg border border-border bg-card p-6 text-center"><h2 className="text-xl font-bold">Доступ ограничен</h2><p className="mt-1 text-muted-foreground">Раздел доступен модераторам и администраторам.</p>{!currentUser && <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</button>}</section>;

    return (
        <section className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase text-primary">Модерация</p><h2 className="text-2xl font-bold">Точки из постов</h2><p className="text-muted-foreground">Проверьте координаты, рыбу и наживки перед публикацией на карте.</p></div><Link to="/moderation" className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Очередь постов</Link></div>
            <div className="flex flex-wrap gap-2">{statuses.map((item) => <button key={item.value} onClick={() => setStatus(item.value)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${status === item.value ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{item.label}</button>)}</div>
            {notice && <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            {loading ? <p className="py-10 text-center text-muted-foreground">Загрузка…</p> : items.length === 0 ? <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">В этой очереди заявок нет.</p> : (
                <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                    <div className="max-h-190 overflow-y-auto rounded-lg border border-border bg-card">{items.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`block w-full border-b border-border p-3 text-left last:border-0 ${item.id === selectedId ? "bg-muted" : "hover:bg-muted/60"}`}><span className="block font-bold">{item.waterbodyName}</span><span className="block text-sm text-muted-foreground">{item.authorName} · {item.gameCoordinateX}:{item.gameCoordinateY}</span><span className="block text-xs text-muted-foreground">{formatDate(item.createdAt)}</span></button>)}</div>
                    {selected && <div className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{selected.waterbodyName}</h3><p className="text-sm text-muted-foreground">Автор: {selected.authorName} · заявка #{selected.id}</p></div><Link to={`/posts/${selected.postId}`} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-bold">Открыть пост <ExternalLink size={14} /></Link></div>
                        {selected.description && <p className="line-clamp-3 text-sm text-muted-foreground">{selected.description}</p>}
                        {isOwn && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">Это ваша публикация. Подтвердить или отклонить её должен другой модератор.</p>}
                        {status === "pending" && <>
                            <PostLocationPicker key={selected.id} waterbodyId={selected.waterbodyId} value={location} onChange={setLocation} />
                            {location.proposedSpotId === null && <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Название новой точки *</span><input maxLength={150} value={name} onChange={(event) => setName(event.target.value)} /></label>}
                            <div className="grid gap-3"><h4 className="font-bold">Рыба и наживки</h4><MultiCombobox options={fishOptions} selected={targetIds} onChange={changeTargetFish} placeholder="+ Добавить рыбу" />{targets.map((target) => <label key={target.fishId} className="grid gap-1 text-sm sm:grid-cols-[180px_1fr] sm:items-start"><span className="pt-2 font-medium">{waterbody?.fish.find((fish) => fish.id === target.fishId)?.name}</span><MultiCombobox options={baitOptions} selected={target.baitIds} onChange={(baitIds) => setTargets((current) => current.map((item) => item.fishId === target.fishId ? { ...item, baitIds } : item))} placeholder="+ Добавить наживку" /></label>)}</div>
                            <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[auto_1fr_auto]"><button disabled={busy || isOwn} onClick={() => void approve()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Check size={16} /> Одобрить</button><input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} maxLength={1000} placeholder="Причина отклонения" /><button disabled={busy || isOwn} onClick={() => void reject()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-bold text-destructive disabled:opacity-50"><X size={16} /> Отклонить</button></div>
                        </>}
                    </div>}
                </div>
            )}
        </section>
    );
}
