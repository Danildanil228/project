import type { BaitDomain, BaitKind } from "./bait";
import type { FishRarity } from "./fish";

export type SpotFish = { id: number; name: string; rarity: FishRarity; photo: string | null };
export type SpotBait = {
    id: number;
    name: string;
    kind: BaitKind;
    photo: string | null;
    domain: BaitDomain;
    categoryCode: string | null;
    categoryName: string | null;
};
export type SpotPost = {
    postId: number;
    publishedAt: string;
    authorName: string;
    targets: Array<{ fishId: number; fishName: string; baits: SpotBait[] }>;
};

export const spotFishingMethods = ["Поплавок", "Донка", "Спиннинг", "Морская", "Троллинг"] as const;
export type SpotFishingMethod = (typeof spotFishingMethods)[number];
export type SpotGeometryType = "point" | "trolling";
export type SpotMapPoint = { mapX: number; mapY: number };

export type SpotVariant = {
    id: number;
    fishingMethod: SpotFishingMethod | null;
    description: string | null;
    depth: number | null;
    clipDistance: number | null;
    orderIndex: number;
    fish: SpotFish[];
    baits: SpotBait[];
};

export type SpotVariantInput = {
    fishingMethod: SpotFishingMethod;
    description: string | null;
    depth: number | null;
    clipDistance: number | null;
    fishIds: number[];
    baitIds: number[];
};

export type FishingSpot = {
    id: number;
    waterbodyId: number;
    name: string;
    description: string | null;
    mapX: number;
    mapY: number;
    gameCoordinateX: number | null;
    gameCoordinateY: number | null;
    geometryType: SpotGeometryType;
    trollingArea: SpotMapPoint[] | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    variants: SpotVariant[];
    posts: SpotPost[];
};

export type SpotInput = {
    waterbodyId: number;
    name: string;
    description: string | null;
    mapX: number;
    mapY: number;
    gameCoordinateX: number | null;
    gameCoordinateY: number | null;
    geometryType: SpotGeometryType;
    trollingArea: SpotMapPoint[] | null;
    variants: SpotVariantInput[];
    isActive: boolean;
};
