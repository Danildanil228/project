export type BaitDomain = "bait" | "lure";
export type BaitKind = "natural" | "prepared" | "boilie" | "pellet" | "artificial_lure" | "marine" | "groundbait_component" | "other";

export type BaitCategory = {
    code: string;
    domain: BaitDomain;
    name: string;
};

export type BaitCatalogMeta = {
    categories: BaitCategory[];
};

export type Bait = {
    id: number;
    name: string;
    kind: BaitKind;
    domain: BaitDomain;
    categoryCode: string | null;
    categoryName: string | null;
    photo: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export type BaitInput = {
    name: string;
    domain: BaitDomain;
    categoryCode: string;
    photo: string | null;
    isActive: boolean;
};

export const baitDomainLabels: Record<BaitDomain, string> = {
    bait: "Наживка",
    lure: "Приманка",
};
