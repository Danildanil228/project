import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "@google/model-viewer";
import { fetchItem, type ItemType } from "../lib/items-api";
import type { Reel } from "../types/reel";
import type { Rod } from "../types/rod";

const reelFields: [keyof Reel, string][] = [
    ["brend", "Бренд"],
    ["lvl", "Уровень"],
    ["size", "Размер"],
    ["test", "Тест"],
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

    return (
        <section className="grid gap-5">
            <Link to="/catalog" className="text-sm font-medium text-primary">
                ← К каталогу
            </Link>

            {loading ? (
                <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
            ) : error ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : item ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {model ? (
                            <model-viewer
                                src={`/${model}`}
                                alt={item.name}
                                camera-controls
                                auto-rotate
                                shadow-intensity="0"
                                environment-image="neutral"
                                style={{ width: "100%", height: "360px" }}
                            />
                        ) : (
                            <div className="flex h-[360px] items-center justify-center bg-muted text-muted-foreground">Нет изображения</div>
                        )}
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
