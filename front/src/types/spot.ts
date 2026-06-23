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

export type FishingSpot = {
    id: number;
    waterbodyId: number;
    name: string;
    description: string | null;
    mapX: number;
    mapY: number;
    gameCoordinateX: number | null;
    gameCoordinateY: number | null;
    depth: number | null;
    clipDistance: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    fish: SpotFish[];
    baits: SpotBait[];
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
    depth: number | null;
    clipDistance: number | null;
    fishIds: number[];
    baitIds: number[];
    isActive: boolean;
};
