import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Box, Image } from "lucide-react";
import { fetchItem, mediaUrl, type ItemType } from "../lib/items-api";
import type { Reel } from "../types/reel";
import type { Rod } from "../types/rod";
import { LoadingSpinner } from "../components/LoadingState";
import { ItemDetailSkeleton } from "../components/PageSkeletons";
import { LoadingImage } from "../components/LoadingImage";

const ModelViewerPanel = lazy(() => import("../components/ModelViewerPanel").then((module) => ({ default: module.ModelViewerPanel })));

const reelFields: [keyof Reel, string][] = [
    ["brend", "Бренд"],
    ["lvl", "Уровень"],
    ["size", "Размер"],
    ["test", "Тест"],
    ["test_mod", "Тест (мод.)"],
    ["protection", "Защита от воды"],
    ["per", "Передаточное число"],
    ["per_mod", "Передаточное (мод.)"],
    ["speed", "Скорость подмотки"],
    ["speed_mod", "Скорость (мод.)"],
    ["frik", "Фрикцион"],
    ["frik_mod", "Фрикцион (мод.)"],
    ["meh", "Механизм"],
    ["meh_mod", "Механизм (мод.)"],
    ["capacity", "Ёмкость шпули"],
    ["capacity_mod", "Ёмкость шпули (мод.)"],
    ["price_ser", "Цена (серебро)"],
    ["price_gold", "Цена (золото)"],
];

const rodFields: [keyof Rod, string][] = [
    ["type", "Тип"],
    ["brend", "Бренд"],
    ["lvl", "Уровень"],
    ["power", "Мощность"],
    ["test_down", "Тест (мин.)"],
    ["test_up", "Тест (макс.)"],
    ["length", "Длина"],
    ["sensi", "Чувствительность"],
    ["rig", "Оснастка"],
    ["stroy", "Строй"],
    ["stren", "Прочность"],
    ["bonus_opit", "Бонус к опыту"],
    ["bonus_snast", "Бонус к снасти"],
    ["bonus_nav", "Бонус к навыку"],
    ["bonus_zabros", "Бонус к забросу"],
    ["price_ser", "Цена (серебро)"],
    ["price_gold", "Цена (золото)"],
];

export function ItemDetailPage() {
    const { type, id } = useParams<{ type: string; id: string }>();
    const [item, setItem] = useState<Reel | Rod | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [mediaMode, setMediaMode] = useState<"photo" | "model">("photo");

    const isValidType = type === "reels" || type === "rods";

    useEffect(() => {
        if (!isValidType) {
            setError("Неизвестный тип предмета");
            setLoading(false);
            return;
        }
        let ignore = false;
        setLoading(true);
        setError("");
        setMediaMode("photo");
        fetchItem(type as ItemType, Number(id))
            .then((response) => {
                if (!ignore) setItem(response.item);
            })
            .catch((caught) => {
                if (!ignore) setError(caught instanceof Error ? caught.message : "Ошибка загрузки");
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => {
            ignore = true;
        };
    }, [type, id, isValidType]);

    const fields = type === "reels" ? reelFields : rodFields;
    const model = item && type === "reels" ? (item as Reel).model : null;
    const photo = item ? ((item as Record<string, unknown>).photo as string | null) : null;
    const catalogPath = type === "reels" ? "/catalog/reels" : "/catalog/rods";
    const catalogLabel = type === "reels" ? "К катушкам" : "К удилищам";

    return (
        <section className="grid gap-5">
            <Link to={catalogPath} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline">
                <ArrowLeft size={15} /> {catalogLabel}
            </Link>

            {loading ? (
                <ItemDetailSkeleton />
            ) : error ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : item ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="grid content-start gap-2">
                        {model && (
                            <div className="inline-flex w-fit rounded-lg border border-border bg-card p-1" aria-label="Вид снасти">
                                <button
                                    type="button"
                                    onClick={() => setMediaMode("photo")}
                                    aria-pressed={mediaMode === "photo"}
                                    className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${mediaMode === "photo" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                >
                                    <Image size={15} /> Фото
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMediaMode("model")}
                                    aria-pressed={mediaMode === "model"}
                                    className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${mediaMode === "model" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                >
                                    <Box size={15} /> 3D-модель
                                </button>
                            </div>
                        )}
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                            {mediaMode === "model" && model ? (
                                <Suspense fallback={<div className="grid h-[360px] place-items-center bg-muted"><LoadingSpinner label="Подготовка 3D-модели" size={24} /></div>}>
                                    <ModelViewerPanel src={model} alt={item.name} poster={photo} />
                                </Suspense>
                            ) : photo ? (
                                <LoadingImage src={mediaUrl(photo)} alt={item.name} title={item.name} className="h-[360px] w-full" imageClassName="object-contain" />
                            ) : (
                                <div className="flex h-[360px] items-center justify-center bg-muted text-muted-foreground">Нет изображения</div>
                            )}
                        </div>
                    </div>

                    <div className="grid content-start gap-3">
                        <div>
                            <p className="text-xs font-extrabold uppercase text-primary">{item.category}</p>
                            <h2 className="text-2xl font-bold">{item.name}</h2>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {fields.map(([key, label]) => {
                                const value = (item as Record<string, unknown>)[key as string];
                                if (value === null || value === undefined || value === "") return null;
                                const display = typeof value === "boolean" ? (value ? "Да" : "Нет") : String(value);
                                return (
                                    <div key={String(key)} className="border-b border-border pb-1">
                                        <dt className="text-xs text-muted-foreground">{label}</dt>
                                        <dd className="font-medium">{display}</dd>
                                    </div>
                                );
                            })}
                        </dl>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
