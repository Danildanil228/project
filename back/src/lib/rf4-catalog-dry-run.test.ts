import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyCatalogItem, deriveVariantCode, matchCatalogFamily, type CatalogFamily } from "./rf4-catalog-dry-run";

test("classifies representative bait and lure assets", () => {
    assert.equal(classifyCatalogItem("bait", "boils_hvz_hp_pu18", "Острый перец Pop-Ups 18", "assets/gfx/baits/boil/x.prefab").category, "pop_up_boilies");
    assert.equal(classifyCatalogItem("bait", "bloodworm", "Мотыль", "assets/gfx/baits/bloodworm/bloodworm.prefab").category, "larvae");
    assert.equal(classifyCatalogItem("lure", "crankbaits_2114", "Raptor 60-4 - 001", "assets/gfx/lures/atomic/crankbaits_2114/x.prefab").category, "wobblers");
    assert.equal(classifyCatalogItem("lure", "softplastic_g_1285", "Quicker 4.5-007", "assets/gfx/lures/x/softplastic/x.prefab").category, "soft_plastic");
    assert.equal(classifyCatalogItem("lure", "hm_walker_65f_001_hq", "Balsa walker 65F-001", "assets/gfx/lures/handmade_lures/x.prefab").category, "topwater");
});

test("matches the longest family prefix and derives variant code", () => {
    const families: CatalogFamily[] = [
        { brandSystemId: "atomic", brandName: "Atomic", systemId: "raptor", name: "Raptor", description: "" },
        { brandSystemId: "atomic", brandName: "Atomic", systemId: "raptor_60_4", name: "Raptor 60-4", description: "" },
    ];
    const matched = matchCatalogFamily("Raptor 60-4 - 001", families, "atomic");
    assert.equal(matched.family?.systemId, "raptor_60_4");
    assert.equal(deriveVariantCode("Raptor 60-4 - 001", matched.family?.name), "001");

    const compactMatch = matchCatalogFamily("Power Jerk 9S-001", [
        { brandSystemId: "syberia", brandName: "Syberia", systemId: "power9", name: "Power Jerk 9", description: "" },
    ]);
    assert.equal(compactMatch.family?.systemId, "power9");
});

test("escapes CSV cells", async () => {
    const { csvCell } = await import("./rf4-catalog-dry-run");
    assert.equal(csvCell('a,"b"'), '"a,""b"""');
});
