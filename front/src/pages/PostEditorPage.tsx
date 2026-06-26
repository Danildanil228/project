import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Combobox, type ComboboxOption } from "../components/Combobox";
import { MultiCombobox } from "../components/MultiCombobox";
import { PhotoDropzone } from "../components/PhotoDropzone";
import { emptyPostLocation, PostLocationPicker, type PostLocationValue } from "../components/PostLocationPicker";
import { getWaterbody, listBaits, listFish, listWaterbodies } from "../lib/reference-api";
import { postLocationDetailsEnabled } from "../lib/features";
import { createPost, getPost, moderatorEditPost, toPostPayload, updatePost, uploadPostMedia } from "../lib/posts-api";
import type { AdminSecurityContext, ManagedUser } from "../types/admin";
import type { Bait } from "../types/bait";
import type { Fish } from "../types/fish";
import type { WaterbodyListRow } from "../types/waterbody";
import { fishingMethods, type FishingMethod, type PostContentInput } from "../types/post";
import { getErrorMessage, hasElevatedUserAccess } from "../utils/admin-format";

type PostEditorPageProps = {
    currentUser?: ManagedUser;
    adminContext?: AdminSecurityContext | null;
    onOpenAuthModal: () => void;
    // In "moderate" mode the editor lets a moderator edit any post (skips author/status checks) and saves via /moderate.
    mode?: "author" | "moderate";
};

const maxPhotos = 8;

export function PostEditorPage({ currentUser, adminContext, onOpenAuthModal, mode = "author" }: PostEditorPageProps) {
    const navigate = useNavigate();
    const params = useParams();
    const editingId = params.id ? Number(params.id) : null;
    const isElevated = hasElevatedUserAccess(currentUser, adminContext);
    const isModerating = mode === "moderate";

    const [allFish, setAllFish] = useState<Fish[]>([]);
    const [allBaits, setAllBaits] = useState<Bait[]>([]);
    const [habitatFishIds, setHabitatFishIds] = useState<number[] | null>(null);
    const [waterbodies, setWaterbodies] = useState<WaterbodyListRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [description, setDescription] = useState("");
    const [waterbodyId, setWaterbodyId] = useState<number | null>(null);
    const [point, setPoint] = useState("");
    const [fishingMethod, setFishingMethod] = useState<FishingMethod | "">("");
    const [income, setIncome] = useState("");
    const [hours, setHours] = useState("");
    const [minutes, setMinutes] = useState("");
    const [fishIds, setFishIds] = useState<number[]>([]);
    const [baitMode, setBaitMode] = useState<"common" | "per_fish">("common");
    const [commonBaitIds, setCommonBaitIds] = useState<number[]>([]);
    const [fishBaitIds, setFishBaitIds] = useState<Record<number, number[]>>({});
    const [location, setLocation] = useState<PostLocationValue>(emptyPostLocation);
    const [media, setMedia] = useState<string[]>([]);
    const [skipModeration, setSkipModeration] = useState(false);
    // Curated/community: moderator+ only. Bypasses moderation and renders without a clickable author.
    const [isCurated, setIsCurated] = useState(false);
    const [curatedLabel, setCuratedLabel] = useState("");

    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }
        let ignore = false;
        setLoading(true);
        setLoadError("");

        async function load() {
            try {
                const [fish, water, baits] = await Promise.all([listFish({ limit: 500 }), listWaterbodies({ limit: 200 }), listBaits({ limit: 500 })]);
                if (ignore) return;
                setAllFish(fish.items);
                setWaterbodies(water.items);
                setAllBaits(baits.items);

                if (editingId) {
                    const { post } = await getPost(editingId);
                    if (ignore) return;
                    // Curated posts: only moderator+ can edit, regardless of author_id.
                    if (post.isCurated) {
                        if (!isElevated) {
                            setLoadError("Редактировать посты сообщества может только модератор.");
                            return;
                        }
                        setIsCurated(true);
                        setCuratedLabel(post.curatedLabel ?? "");
                    } else if (!isModerating) {
                        if (post.authorId !== currentUser?.id) {
                            setLoadError("Это не ваш пост — редактировать нельзя.");
                            return;
                        }
                        if (post.status !== "draft" && post.status !== "rejected") {
                            setLoadError("Этот пост сейчас нельзя редактировать (он на проверке или опубликован).");
                            return;
                        }
                    } else if (!isElevated) {
                        setLoadError("Доступ только для модераторов.");
                        return;
                    } else if (post.status === "deleted") {
                        setLoadError("Удалённый пост нельзя редактировать.");
                        return;
                    }
                    const version = post.version;
                    if (version) {
                        setDescription(version.description ?? "");
                        setWaterbodyId(version.waterbodyId ?? null);
                        setPoint(version.point ?? "");
                        setFishingMethod(version.fishingMethod ?? "");
                        setIncome(version.income != null ? String(version.income) : "");
                        if (version.fishingMinutes != null) {
                            setHours(String(Math.floor(version.fishingMinutes / 60)));
                            setMinutes(String(version.fishingMinutes % 60));
                        }
                        setFishIds(version.catches.map((item) => item.fishId));
                        setBaitMode(version.baitMode);
                        setCommonBaitIds(version.commonBaits.map((item) => item.id));
                        setFishBaitIds(Object.fromEntries(version.catches.map((item) => [item.fishId, item.baits.map((bait) => bait.id)])));
                        setLocation({
                            proposedSpotId: version.proposedSpotId,
                            mapX: version.mapX,
                            mapY: version.mapY,
                            gameCoordinateX: version.gameCoordinateX,
                            gameCoordinateY: version.gameCoordinateY,
                            mapX2: version.mapX2 ?? null,
                            mapY2: version.mapY2 ?? null,
                            gameCoordinateX2: version.gameCoordinateX2 ?? null,
                            gameCoordinateY2: version.gameCoordinateY2 ?? null,
                        });
                        setMedia(version.media.map((item) => item.url));
                    }
                }
            } catch (caught) {
                if (!ignore) setLoadError(getErrorMessage(caught));
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        void load();
        return () => {
            ignore = true;
        };
        // currentUser?.id is the stable identity; depending on the object would refetch on every session re-render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id, editingId]);

    useEffect(() => {
        if (!waterbodyId) { setHabitatFishIds(null); return; }
        let ignore = false;
        getWaterbody(waterbodyId)
            .then(({ item }) => { if (!ignore) setHabitatFishIds(item.fish.map((fish) => fish.id)); })
            .catch(() => { if (!ignore) setHabitatFishIds([]); });
        return () => { ignore = true; };
    }, [waterbodyId]);

    const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    const incomePerHourPreview = useMemo(() => {
        const incomeNumber = Number(income);
        if (!incomeNumber || totalMinutes <= 0) return null;
        return Math.round((incomeNumber * 60) / totalMinutes);
    }, [income, totalMinutes]);

    const waterbodyOptions = useMemo<ComboboxOption[]>(
        () => waterbodies.map((water) => ({ id: water.id, name: water.name })),
        [waterbodies],
    );
    const fishOptions = useMemo<ComboboxOption[]>(
        () => allFish.filter((fish) => habitatFishIds?.includes(fish.id)).map((fish) => ({ id: fish.id, name: fish.name, hint: fish.rarity })),
        [allFish, habitatFishIds],
    );
    const baitOptions = useMemo<ComboboxOption[]>(
        () => allBaits.map((bait) => ({ id: bait.id, name: bait.name, hint: bait.kind })),
        [allBaits],
    );

    function changeWaterbody(nextId: number | null) {
        setWaterbodyId(nextId);
        setLocation(emptyPostLocation);
        setFishIds([]);
        setFishBaitIds({});
    }

    function changeFish(nextIds: number[]) {
        setFishIds(nextIds);
        setFishBaitIds((current) => Object.fromEntries(Object.entries(current).filter(([fishId]) => nextIds.includes(Number(fishId)))));
    }

    async function handleAddFiles(files: File[]) {
        const slots = maxPhotos - media.length;
        if (slots <= 0) {
            setUploadError(`Можно загрузить максимум ${maxPhotos} фото`);
            return;
        }
        setUploading(true);
        setUploadError("");
        try {
            for (const file of files.slice(0, slots)) {
                const { url } = await uploadPostMedia(file);
                setMedia((previous) => (previous.length >= maxPhotos ? previous : [...previous, url]));
            }
            if (files.length > slots) {
                setUploadError(`Добавлено только ${slots} — лимит ${maxPhotos} фото`);
            }
        } catch (caught) {
            setUploadError(getErrorMessage(caught));
        } finally {
            setUploading(false);
        }
    }

    function buildContent(): PostContentInput {
        return {
            description,
            waterbodyId,
            point: point.trim() || null,
            fishingMethod: fishingMethod || null,
            income: income !== "" ? Number(income) : null,
            fishingMinutes: totalMinutes > 0 ? totalMinutes : null,
            catches: fishIds.map((fishId) => ({ fishId, baitIds: postLocationDetailsEnabled && baitMode === "per_fish" ? fishBaitIds[fishId] ?? [] : [] })),
            baitMode: postLocationDetailsEnabled ? baitMode : "common",
            commonBaitIds: postLocationDetailsEnabled && baitMode === "common" ? commonBaitIds : [],
            ...(postLocationDetailsEnabled ? location : emptyPostLocation),
            media,
        };
    }

    function validateForSubmit(content: PostContentInput): string | null {
        const problems: string[] = [];
        if (!content.waterbodyId) problems.push("выберите водоём");
        if (!content.fishingMethod) problems.push("выберите вид ловли");
        if (!content.point) problems.push("укажите точку");
        if (content.catches.length === 0) problems.push("добавьте хотя бы одну рыбу");
        if (content.media.length === 0) problems.push("добавьте хотя бы одно фото");
        return problems.length ? `Чтобы отправить: ${problems.join(", ")}.` : null;
    }

    function validateForDraft(content: PostContentInput): string | null {
        const hasAny =
            content.description.trim().length > 0 ||
            content.waterbodyId != null ||
            (content.point?.trim()?.length ?? 0) > 0 ||
            content.fishingMethod != null ||
            content.income != null ||
            content.fishingMinutes != null ||
            content.catches.length > 0 ||
            content.gameCoordinateX != null ||
            content.media.length > 0;
        return hasAny ? null : "Пустой черновик сохранить нельзя — заполните хотя бы одно поле.";
    }

    async function save(submit: boolean) {
        const content = buildContent();
        if (submit || isModerating) {
            const problem = validateForSubmit(content);
            if (problem) {
                setFormError(problem);
                return;
            }
        } else {
            const problem = validateForDraft(content);
            if (problem) {
                setFormError(problem);
                return;
            }
        }
        setSaving(true);
        setFormError("");
        try {
            if (isModerating && editingId) {
                await moderatorEditPost(editingId, content);
                navigate("/moderation");
                return;
            }
            const payload = toPostPayload(content, {
                submit: submit || isCurated,
                skipModeration: submit && isElevated ? skipModeration : false,
                isCurated: isCurated && isElevated,
                curatedLabel: isCurated && isElevated ? curatedLabel : null,
            });
            if (editingId) {
                await updatePost(editingId, payload);
            } else {
                await createPost(payload);
            }
            navigate("/posts");
        } catch (caught) {
            setFormError(getErrorMessage(caught));
        } finally {
            setSaving(false);
        }
    }

    function onSubmit(event: FormEvent) {
        event.preventDefault();
    }

    if (!currentUser) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                    <h2 className="text-xl font-bold">Нужен вход</h2>
                    <p className="mt-1 text-muted-foreground">Чтобы создать пост, войдите в аккаунт.</p>
                    <button onClick={onOpenAuthModal} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                        Войти
                    </button>
                </div>
            </section>
        );
    }

    if (loading) {
        return <p className="py-10 text-center text-muted-foreground">Загрузка…</p>;
    }

    if (loadError) {
        return (
            <section className="grid gap-4">
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
                    <p className="text-destructive">{loadError}</p>
                    <Link to={isModerating ? "/moderation" : "/posts"} className="mt-3 inline-block rounded-lg border border-border px-4 py-2 text-sm font-bold">
                        {isModerating ? "К очереди модерации" : "К моим постам"}
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="grid gap-5">
            <div className="grid gap-1">
                <p className="text-xs font-extrabold uppercase text-primary">{isModerating ? "Модерация" : "Посты"}</p>
                <h2 className="text-2xl font-bold">{isModerating ? "Редактирование поста модератором" : editingId ? "Редактирование поста" : "Новый пост"}</h2>
                <p className="text-muted-foreground">
                    {isModerating
                        ? "Правки фиксируются как новая версия. Для одобренного поста время публикации обновится."
                        : "Расскажите о рыбалке: водоём, улов, точка, фото. Можно сохранить черновик и отправить позже."}
                </p>
            </div>

            {formError && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}

            <form onSubmit={onSubmit} className="grid gap-5">
                <div className={`grid gap-4 rounded-lg border border-border bg-card p-4 ${waterbodyId ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)]" : ""}`}>
                    <div className="grid content-start gap-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1 text-sm">
                                <span className="text-muted-foreground">Водоём *</span>
                                <Combobox
                                    options={waterbodyOptions}
                                    value={waterbodyId}
                                    onChange={changeWaterbody}
                                    placeholder="— выберите водоём —"
                                    searchPlaceholder="Поиск водоёма…"
                                />
                            </label>
                            <label className="grid gap-1 text-sm">
                                <span className="text-muted-foreground">Вид ловли *</span>
                                <select name="fishingMethod" value={fishingMethod} onChange={(event) => setFishingMethod(event.target.value as FishingMethod | "")}>
                                    <option value="">— выберите вид —</option>
                                    {fishingMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                                </select>
                            </label>
                            <label className="grid gap-1 text-sm sm:col-span-2">
                                <span className="text-muted-foreground">Точка *</span>
                                <input value={point} onChange={(event) => setPoint(event.target.value)} maxLength={50} placeholder="Например, 75:88 или клипса 35 м" />
                            </label>
                        </div>

                        <label className="grid gap-1 text-sm">
                            <span className="text-muted-foreground">Описание</span>
                            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={5000} placeholder="Как ловилось, какие снасти и условия…" className="resize-y" />
                        </label>
                    </div>
                    {postLocationDetailsEnabled && waterbodyId && <PostLocationPicker key={waterbodyId} waterbodyId={waterbodyId} value={location} onChange={setLocation} />}
                </div>

                {/* Разнорыбица — улов */}
                <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold">Улов *</h3>
                        <span className="text-xs text-muted-foreground">Можно добавить несколько видов рыб (разнорыбица)</span>
                    </div>

                    {fishOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{waterbodyId ? "Для этого водоёма не указан список обитателей." : "Сначала выберите водоём."}</p>
                    ) : (
                        <MultiCombobox
                            options={fishOptions}
                            selected={fishIds}
                            onChange={changeFish}
                            placeholder="+ Добавить рыбу"
                            searchPlaceholder="Поиск рыбы…"
                        />
                    )}

                    {postLocationDetailsEnabled && fishIds.length > 0 && (
                        <div className="grid gap-3 border-t border-border pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-bold">Наживки и приманки</h4>
                                <div className="inline-flex rounded-lg border border-border p-1 text-xs">
                                    <button type="button" onClick={() => setBaitMode("common")} className={`rounded px-3 py-1.5 ${baitMode === "common" ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}>Общие для улова</button>
                                    <button type="button" onClick={() => setBaitMode("per_fish")} className={`rounded px-3 py-1.5 ${baitMode === "per_fish" ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}>Отдельно по рыбе</button>
                                </div>
                            </div>
                            {baitMode === "common" ? (
                                <MultiCombobox options={baitOptions} selected={commonBaitIds} onChange={setCommonBaitIds} placeholder="+ Добавить наживку" searchPlaceholder="Поиск наживки…" />
                            ) : (
                                <div className="grid gap-3">
                                    {fishIds.map((fishId) => (
                                        <label key={fishId} className="grid gap-1 text-sm sm:grid-cols-[180px_1fr] sm:items-start">
                                            <span className="pt-2 font-medium">{allFish.find((fish) => fish.id === fishId)?.name}</span>
                                            <MultiCombobox options={baitOptions} selected={fishBaitIds[fishId] ?? []} onChange={(ids) => setFishBaitIds((current) => ({ ...current, [fishId]: ids }))} placeholder="+ Добавить наживку" searchPlaceholder="Поиск наживки…" />
                                        </label>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">Это поле необязательно. Модератор сможет уточнить данные перед публикацией точки на карте.</p>
                        </div>
                    )}
                </div>

                {/* Фото — drag&drop + порядок */}
                <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold">Фотографии *</h3>
                        <span className="text-xs text-muted-foreground">{media.length}/{maxPhotos} · перетаскиванием можно менять порядок</span>
                    </div>
                    <PhotoDropzone photos={media} onChange={setMedia} onAddFiles={handleAddFiles} uploading={uploading} maxPhotos={maxPhotos} />
                    {uploadError && <span className="text-xs text-destructive">{uploadError}</span>}
                </div>

                {/* Заработок и время */}
                <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
                    <h3 className="font-bold">Заработок и время <span className="text-xs font-normal text-muted-foreground">(необязательно)</span></h3>
                    <div className="grid gap-3 sm:grid-cols-[12rem_8rem_8rem_1fr] sm:items-end">
                        <label className="grid gap-1 text-sm">
                            <span className="text-muted-foreground">Заработано, серебро</span>
                            <input name="income" type="number" min={0} step="1" value={income} onChange={(event) => setIncome(event.target.value)} placeholder="—" />
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="text-muted-foreground">Часов</span>
                            <input name="hours" type="number" min={0} step="1" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" />
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="text-muted-foreground">Минут</span>
                            <input name="minutes" type="number" min={0} max={59} step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="0" />
                        </label>
                        {incomePerHourPreview != null && (
                            <p className="text-sm text-muted-foreground">≈ <strong className="text-foreground">{incomePerHourPreview.toLocaleString("ru-RU")}</strong> серебра/час</p>
                        )}
                    </div>
                </div>

                {/* Действия */}
                <div className="flex flex-wrap items-center gap-3">
                    {isModerating ? (
                        <button type="button" onClick={() => void save(true)} disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                            {saving ? "Сохранение…" : "Сохранить правки"}
                        </button>
                    ) : (
                        <>
                            {/* Curated posts go straight to approved on the backend — no draft step. */}
                            {!isCurated && (
                                <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-lg border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                                    {saving ? "Сохранение…" : "Сохранить черновик"}
                                </button>
                            )}
                            <button type="button" onClick={() => void save(true)} disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                                {isCurated ? "Опубликовать (Сообщество)" : isElevated && skipModeration ? "Опубликовать" : "Отправить на проверку"}
                            </button>
                            {isElevated && (
                                <div onClick={() => setSkipModeration((value) => !value)} className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input type="checkbox" readOnly checked={skipModeration} className="pointer-events-none shrink-0" />
                                    <span>Опубликовать без проверки</span>
                                </div>
                            )}
                            {/* Curated/community post — moderator+ only. Bypasses moderation; no clickable author in feed. */}
                            {isElevated && (
                                <div className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-border bg-card/60 p-3 sm:w-auto sm:flex-row sm:items-center">
                                    <button
                                        type="button"
                                        onClick={() => setIsCurated((value) => !value)}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <input type="checkbox" readOnly checked={isCurated} className="pointer-events-none shrink-0" />
                                        <span>Опубликовать как «Сообщество»</span>
                                    </button>
                                    {isCurated && (
                                        <input
                                            type="text"
                                            value={curatedLabel}
                                            onChange={(event) => setCuratedLabel(event.target.value)}
                                            placeholder="Подпись (необязательно), напр. «Архив»"
                                            maxLength={60}
                                            className="h-8 text-sm sm:w-56"
                                        />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    <Link to={isModerating ? "/moderation" : "/posts"} className="ml-auto text-sm text-muted-foreground hover:text-foreground">
                        Отмена
                    </Link>
                </div>
            </form>
        </section>
    );
}
