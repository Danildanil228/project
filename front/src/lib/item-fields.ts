import { itemCategories, type ItemType } from "./items-api";

export type ItemFieldKind = "text" | "number" | "select" | "checkbox" | "file";

export type ItemFieldDef = {
    key: string;
    label: string;
    // Optional compact header for the catalog table. Falls back to `label` everywhere else (forms, cards).
    shortLabel?: string;
    kind: ItemFieldKind;
    required?: boolean;
    options?: string[];
    mediaKind?: "image" | "model";
    accept?: string;
};

const imageAccept = "image/png,image/jpeg,image/webp,image/gif";

export const itemFields: Record<ItemType, ItemFieldDef[]> = {
    reels: [
        { key: "name", label: "Название", kind: "text", required: true },
        { key: "category", label: "Категория", kind: "select", required: true, options: itemCategories.reels },
        { key: "brend", label: "Бренд", kind: "text", required: true },
        { key: "size", label: "Размер", kind: "number" },
        { key: "test", label: "Тест", kind: "text", required: true },
        { key: "test_mod", label: "Тест (мод.)", shortLabel: "Тест м.", kind: "text" },
        { key: "protection", label: "Защита от воды", shortLabel: "Влагозащ.", kind: "checkbox" },
        { key: "per", label: "Передаточное число", shortLabel: "Передача", kind: "text", required: true },
        { key: "per_mod", label: "Передаточное (мод.)", shortLabel: "Перед. м.", kind: "text" },
        { key: "speed", label: "Скорость подмотки", shortLabel: "Скорость", kind: "text", required: true },
        { key: "speed_mod", label: "Скорость (мод.)", shortLabel: "Скор. м.", kind: "text" },
        { key: "frik", label: "Фрикцион", kind: "text", required: true },
        { key: "frik_mod", label: "Фрикцион (мод.)", shortLabel: "Фрик. м.", kind: "text" },
        { key: "meh", label: "Механизм", kind: "text", required: true },
        { key: "meh_mod", label: "Механизм (мод.)", shortLabel: "Мех. м.", kind: "text" },
        { key: "lvl", label: "Уровень", shortLabel: "Ур.", kind: "number" },
        { key: "price_ser", label: "Цена (серебро)", shortLabel: "Серебро", kind: "text" },
        { key: "price_gold", label: "Цена (золото)", shortLabel: "Золото", kind: "text" },
        { key: "capacity", label: "Ёмкость шпули", shortLabel: "Ёмкость", kind: "text" },
        { key: "capacity_mod", label: "Ёмкость шпули (мод.)", shortLabel: "Ёмк. м.", kind: "text" },
        { key: "photo", label: "Фото", kind: "file", mediaKind: "image", accept: imageAccept },
        { key: "model", label: "3D-модель (.glb)", kind: "file", mediaKind: "model", accept: ".glb,model/gltf-binary" },
    ],
    rods: [
        { key: "name", label: "Название", kind: "text", required: true },
        { key: "category", label: "Категория", kind: "select", required: true, options: itemCategories.rods },
        { key: "type", label: "Тип", kind: "text", required: true },
        { key: "brend", label: "Бренд", kind: "text", required: true },
        { key: "power", label: "Мощность", kind: "text" },
        { key: "test_down", label: "Тест (мин.)", shortLabel: "Тест ↓", kind: "text", required: true },
        { key: "test_up", label: "Тест (макс.)", shortLabel: "Тест ↑", kind: "text", required: true },
        { key: "length", label: "Длина", kind: "text", required: true },
        { key: "sensi", label: "Чувствительность", shortLabel: "Чувств.", kind: "text", required: true },
        { key: "rig", label: "Оснастка", kind: "text", required: true },
        { key: "stroy", label: "Строй", kind: "select", required: true, options: ["Быстрый", "Средний", "Медленный", "Сверхбыстрый"] },
        { key: "stren", label: "Прочность", shortLabel: "Прочн.", kind: "text", required: true },
        { key: "bonus_opit", label: "Бонус к опыту", shortLabel: "Опыт", kind: "text" },
        { key: "bonus_snast", label: "Бонус к снасти", shortLabel: "Снасть", kind: "text" },
        { key: "bonus_nav", label: "Бонус к навыку", shortLabel: "Навык", kind: "text" },
        { key: "bonus_zabros", label: "Бонус к забросу", shortLabel: "Заброс", kind: "text" },
        { key: "lvl", label: "Уровень", shortLabel: "Ур.", kind: "number", required: true },
        { key: "price_ser", label: "Цена (серебро)", shortLabel: "Серебро", kind: "text" },
        { key: "price_gold", label: "Цена (золото)", shortLabel: "Золото", kind: "text" },
        { key: "photo", label: "Фото", kind: "file", mediaKind: "image", accept: imageAccept },
    ],
};
