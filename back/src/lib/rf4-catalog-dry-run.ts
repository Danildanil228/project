export type CatalogDomain = "bait" | "lure";

export type CatalogFamily = {
    brandSystemId: string;
    brandName: string;
    systemId: string;
    name: string;
    description: string;
};

export type Classification = {
    category: string | null;
    confidence: "high" | "medium" | "unknown";
    reason: string;
};

const wormFolders = new Set(["black_leech", "muckworm", "surv_worm", "vypolzok_01", "worm_01"]);
const larvaeFolders = new Set(["bloodworm", "caddisfly", "gadfly_little", "maggot", "maggot_caster", "maybug_larva", "scolytinae", "stonefly_nymph", "unibeetle_larva"]);
const insectFolders = new Set(["dorbeetle", "fly", "gadfly", "grasshopper", "gryllotalpa", "cricket", "maybug", "mayfly_podenka", "waterbug"]);
const crustaceanFolders = new Set(["mormysh", "crawfish_meat"]);
const liveFolders = new Set(["frog", "naiad"]);

export function normalizeCatalogName(value: string) {
    return value
        .normalize("NFKC")
        .toLocaleLowerCase("ru-RU")
        .replace(/ё/g, "е")
        .replace(/[–—]/g, "-")
        .replace(/№/g, "#")
        .replace(/\s+/g, " ")
        .trim();
}

function pathFolder(prefabPath: string) {
    return prefabPath.replace(/\\/g, "/").split("/")[3]?.toLowerCase() ?? "";
}

function result(category: string, reason: string, confidence: Classification["confidence"] = "high"): Classification {
    return { category, confidence, reason };
}

export function classifyCatalogItem(domain: CatalogDomain, systemId: string, name: string, prefabPath: string): Classification {
    const id = systemId.toLowerCase();
    const path = prefabPath.toLowerCase().replace(/\\/g, "/");
    const folder = pathFolder(path);

    if (domain === "bait") {
        if (path.includes("/boil/")) {
            return /(?:_pu\d*|pop[ -]?ups?)/i.test(`${id} ${name}`)
                ? result("pop_up_boilies", "boilie prefab marked as pop-up")
                : result("sinking_boilies", "boilie prefab");
        }
        if (path.includes("/pellets/")) return result("pellets", "pellets prefab folder");
        if (path.includes("/crn/")) return result("artificial_corn", "artificial corn prefab folder");
        if (path.includes("/zig_baits/")) return result("zig_rig_foam", "zig-rig prefab folder");
        if (path.includes("/live_fish/")) return result("live_fish", "live fish prefab folder");
        if (path.includes("/dead_fishes/")) return result("dead_fish", "dead fish prefab folder");
        if (path.includes("/porridge/") || path.includes("/dough/")) return result("porridge_dough", "porridge or dough prefab folder");
        if (folder.startsWith("fb_")) return result("marine_bait", "marine bait prefab prefix");
        if (wormFolders.has(folder)) return result("worms", `known worm folder: ${folder}`);
        if (larvaeFolders.has(folder)) return result("larvae", `known larvae folder: ${folder}`);
        if (insectFolders.has(folder)) return result("insects", `known insect folder: ${folder}`);
        if (crustaceanFolders.has(folder)) return result("crustaceans", `known crustacean folder: ${folder}`);
        if (liveFolders.has(folder)) return result("live", `known live bait folder: ${folder}`);
        if (folder === "fish_pieces") return result("fish_fillet", "fish pieces prefab folder");
        if (["bread", "cabbage", "caviar", "cheese_cube", "corn", "nuts", "peas", "potato", "sunflower_cake", "watergrass", "wheat_grain"].includes(folder)) {
            return result("natural", `known natural bait folder: ${folder}`);
        }
        if (["crab_meat", "dreissena", "unio_crassus"].includes(folder)) return result("crustaceans", `shellfish/crustacean folder: ${folder}`, "medium");
        if (folder === "worm_cans") return result("sets", "worm container prefab", "medium");
        return { category: null, confidence: "unknown", reason: `unmapped bait folder: ${folder || "(empty)"}` };
    }

    const haystack = `${id} ${path} ${name.toLowerCase()}`;
    if (/spinnerbaits?/.test(haystack)) return result("spinnerbaits", "spinnerbait marker");
    if (/(?:^|[_/])spinner(?:[_/]|\d)|hm_spinner/.test(haystack)) return result("spinners", "spinner marker");
    if (/spoon|hm_pl/.test(haystack)) return result("spoons", "spoon marker");
    if (/topwater|popper/.test(haystack)) return result("topwater", "topwater/popper marker");
    if (/jerk/.test(haystack)) return result("jerkbaits", "jerkbait marker");
    if (/wacky/.test(haystack)) return result("wacky_worms", "wacky marker");
    if (/pilker|pilkr/.test(haystack)) return result("pilkers", "pilker marker");
    if (/(?:^|[_/])okt[_/\d]/.test(haystack)) return result("octopus", "octopus system id");
    if (/(?:^|[_/])shr[_/\d]/.test(haystack)) return result("shrimp", "shrimp system id");
    if (/^(?:sw)_/.test(id) || /flying worm/.test(haystack)) return result("silicon_sea_worms", "flying sea worm marker");
    if (/^gmh_/.test(id) || /gummimakk/.test(haystack)) return result("gummi_makk", "Gummi Makk marker");
    if (/^hjig_/.test(id) || /hairy.?jig/.test(haystack)) return result("skirted_jigs", "hairy/skirted jig marker");
    if (/fire_tube|tube bait/.test(haystack)) return result("tube_baits", "tube marker");
    if (/fire_stick|p_rattle|attract/.test(haystack)) return result("attraction_elements", "attraction element marker");
    if (/^jhead_/.test(id) || /dead.?fish.?jig/.test(haystack)) return result("dead_fish_jigheads", "dead-fish jighead marker");
    if (/^monojig_|^shad_/.test(id) || /giant.?shad/.test(haystack)) return result("giant_shads", "giant shad marker", "medium");
    if (/^hm_foamr_/.test(id) || /поролоновая рыбка/.test(haystack)) return result("soft_plastic", "foam fish marker", "medium");
    if (/^sf_/.test(id) || /salty fish/.test(haystack)) return result("soft_plastic", "salty soft-plastic fish marker", "medium");
    if (/^hm_walker_/.test(id) || /balsa walker/.test(haystack)) return result("topwater", "walker marker");
    if (/^hm_(?:j_)?minnow_/.test(id) || /wooden (?:joined )?minnow/.test(haystack)) return result("wobblers", "handmade minnow marker");
    if (/^hm_shad_/.test(id) || /balsa shad/.test(haystack)) return result("wobblers", "handmade balsa shad marker");
    if (/^pipe_jig_/.test(id)) return result("pilkers", "marine pipe jig marker", "medium");
    if (id === "old_spinnerlure") return result("spinners", "legacy spinner marker");
    if (/softplastic/.test(haystack)) return result("soft_plastic", "soft-plastic marker");
    if (/crankbaits|(?:^|[_/])crank(?:[_/]|\d)|(?:^|[_/])plug(?:[_/]|\d)/.test(haystack)) return result("wobblers", "crank/plug marker");
    if (/(?:^|[_/])fly(?:[_/]|\d)/.test(haystack)) return result("flies", "fly marker");
    if (/rodent|mouse|animal_art/.test(haystack)) return result("artificial_rodents", "artificial animal marker", "medium");
    return { category: null, confidence: "unknown", reason: "unmapped lure pattern" };
}

function isFamilyBoundary(value: string, length: number) {
    if (value.length === length) return true;
    return /[\s\-/#(]/.test(value[length] ?? "");
}

export function matchCatalogFamily(itemName: string, families: CatalogFamily[], brandHint?: string | null) {
    const normalizedItem = normalizeCatalogName(itemName);
    const compactItem = normalizedItem.replace(/[^a-zа-я0-9]/g, "");
    const normalizedBrandHint = normalizeCatalogName(brandHint ?? "").replace(/[^a-zа-я0-9]/g, "");
    const candidates = families
        .map((family) => ({ family, normalized: normalizeCatalogName(family.name) }))
        .filter(({ normalized }) => {
            if (normalized.length < 2) return false;
            if (normalizedItem.startsWith(normalized) && isFamilyBoundary(normalizedItem, normalized.length)) return true;
            const compactFamily = normalized.replace(/[^a-zа-я0-9]/g, "");
            return compactFamily.length >= 4 && compactItem.startsWith(compactFamily);
        });

    if (!candidates.length) return { family: null, ambiguous: false, candidateCount: 0, candidates: [] as CatalogFamily[] };
    const bestLength = Math.max(...candidates.map((candidate) => candidate.normalized.length));
    let best = candidates.filter((candidate) => candidate.normalized.length === bestLength);
    if (best.length > 1 && normalizedBrandHint) {
        const hinted = best.filter(({ family }) => {
            const brand = normalizeCatalogName(family.brandSystemId).replace(/[^a-zа-я0-9]/g, "");
            return brand.includes(normalizedBrandHint) || normalizedBrandHint.includes(brand);
        });
        if (hinted.length) best = hinted;
    }
    return { family: best[0].family, ambiguous: best.length > 1, candidateCount: best.length, candidates: best.map((candidate) => candidate.family) };
}

export function deriveVariantCode(itemName: string, familyName?: string | null) {
    if (familyName) {
        const remainder = itemName.slice(familyName.length).trim().replace(/^[-–—/#]+\s*/, "").trim();
        if (remainder) return remainder;
    }
    const match = itemName.match(/(?:\s+-\s+|\s+|[-/])([A-ZА-Я]?\d{2,4}|[A-ZА-Я]\d{2,4}|[A-Z0-9-]{3,})$/i);
    return match?.[1] ?? null;
}

export function csvCell(value: unknown) {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
