export type FishRarity = "Обычный" | "Редкий" | "Редчайший";

export const fishRarities: FishRarity[] = ["Обычный", "Редкий", "Редчайший"];

export type Fish = {
    id: number;
    name: string;
    rarity: FishRarity;
    photo: string | null;
    trophyWeightGrams: number | null;
    rareTrophyWeightGrams: number | null;
    waterbodies: Array<{ id: number; name: string }>;
};

export type FishInput = {
    name: string;
    rarity: FishRarity;
    photo: string | null;
    waterbodyIds: number[];
    trophyWeightGrams: number;
    rareTrophyWeightGrams: number;
};
