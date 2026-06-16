import { itemCategories, type ItemType } from "./items-api";

export type ItemFieldKind = "text" | "number" | "select" | "checkbox";

export type ItemFieldDef = {
    key: string;
    label: string;
    kind: ItemFieldKind;
    required?: boolean;
    options?: string[];
};

export const itemFields: Record<ItemType, ItemFieldDef[]> = {
    reels: [
        { key: "name", label: "Название", kind: "text", required: true },
        { key: "category", label: "Категория", kind: "select", required: true, options: itemCategories.reels },
        { key: "brend", label: "Бренд", kind: "text", required: true },
        { key: "size", label: "Размер", kind: "number" },
        { key: "test", label: "Тест", kind: "text", required: true },
        { key: "protection", label: "Защита от воды", kind: "checkbox" },
        { key: "per", label: "Передаточное число", kind: "text", required: true },
        { key: "per_mod", label: "Передаточное (мод.)", kind: "text" },
        { key: "speed", label: "Скорость подмотки", kind: "text", required: true },
        { key: "speed_mod", label: "Скорость (мод.)", kind: "text" },
        { key: "frik", label: "Фрикцион", kind: "text", required: true },
        { key: "frik_mod", label: "Фрикцион (мод.)", kind: "text" },
        { key: "meh", label: "Механизм", kind: "text", required: true },
        { key: "meh_mod", label: "Механизм (мод.)", kind: "text" },
        { key: "lvl", label: "Уровень", kind: "number", required: true },
        { key: "price_ser", label: "Цена (серебро)", kind: "text" },
        { key: "price_gold", label: "Цена (золото)", kind: "text" },
        { key: "capacity", label: "Ёмкость шпули", kind: "text" },
        { key: "photo", label: "Фото (путь)", kind: "text" },
        { key: "model", label: "3D-модель (файл)", kind: "text" },
    ],
    rods: [
        { key: "name", label: "Название", kind: "text", required: true },
        { key: "category", label: "Категория", kind: "select", required: true, options: itemCategories.rods },
        { key: "type", label: "Тип", kind: "text", required: true },
        { key: "brend", label: "Бренд", kind: "text", required: true },
        { key: "power", label: "Мощность", kind: "text" },
        { key: "test_down", label: "Тест (мин.)", kind: "text", required: true },
        { key: "test_up", label: "Тест (макс.)", kind: "text", required: true },
        { key: "length", label: "Длина", kind: "text", required: true },
        { key: "sensi", label: "Чувствительность", kind: "text", required: true },
        { key: "rig", label: "Оснастка", kind: "text", required: true },
        { key: "stroy", label: "Строй", kind: "select", required: true, options: ["Быстрый", "Средний", "Медленный", "Сверхбыстрый"] },
        { key: "stren", label: "Прочность", kind: "text", required: true },
        { key: "bonus_opit", label: "Бонус к опыту", kind: "text" },
        { key: "bonus_snast", label: "Бонус к снасти", kind: "text" },
        { key: "bonus_nav", label: "Бонус к навыку", kind: "text" },
        { key: "bonus_zabros", label: "Бонус к забросу", kind: "text" },
        { key: "lvl", label: "Уровень", kind: "number", required: true },
        { key: "price_ser", label: "Цена (серебро)", kind: "text" },
        { key: "price_gold", label: "Цена (золото)", kind: "text" },
        { key: "photo", label: "Фото (путь)", kind: "text" },
    ],
};
