import type { FishRarity } from "./fish";

export type WaterbodyFish = {
    id: number;
    name: string;
    rarity: FishRarity;
};

export type Waterbody = {
    id: number;
    name: string;
    photo: string | null;
    coordinateMinX: number | null;
    coordinateMinY: number | null;
    coordinateMaxX: number | null;
    coordinateMaxY: number | null;
    fish: WaterbodyFish[];
};

export type WaterbodyListRow = {
    id: number;
    name: string;
    photo: string | null;
    fishCount: number;
    spotCount: number;
};
