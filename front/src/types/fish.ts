export type FishRarity = "Обычный" | "Редкий" | "Редчайший";

export const fishRarities: FishRarity[] = ["Обычный", "Редкий", "Редчайший"];

export type Fish = {
    id: number;
    name: string;
    rarity: FishRarity;
    photo: string | null;
};
