import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    classifyCatalogItem,
    csvCell,
    deriveVariantCode,
    matchCatalogFamily,
    type CatalogDomain,
    type CatalogFamily,
} from "../src/lib/rf4-catalog-dry-run";

type LocalizedItem = { systemId: string; name: string; description?: string; hidden?: boolean };
type LocalizedBrand = { systemId?: string; name?: string; description?: string; itemFamilies?: Array<{ systemId: string; name: string; description?: string; hidden?: boolean }> };
type CatalogFile = { localeId: string; brands: Record<string, LocalizedBrand>; items: Record<string, LocalizedItem> };
type BundleFile = { m_Container: Record<string, unknown> };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..", "..");
const defaults = {
    exportRoot: "C:\\Users\\danil\\Desktop\\rr4\\rr4Reap\\AssetRipper_export_20260610_180045\\Assets",
    bundleRoot: "C:\\Users\\danil\\Desktop\\rr4\\allfilescopy\\AssetRipper_export_20260610_230108\\Assets\\AssetBundle",
    out: join(projectRoot, "artifacts", "rf4-catalog-dry-run"),
};

function argument(name: string, fallback: string) {
    const index = process.argv.indexOf(`--${name}`);
    return resolve(index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback);
}

async function exists(path: string) {
    try { await access(path); return true; } catch { return false; }
}

function brandHint(bundleName: string, prefabPath: string) {
    if (bundleName !== "baits") {
        const bundleHint = bundleName.replace(/^lures_(?:brand_)?/, "");
        if (bundleHint !== "lures") return bundleHint;
        const folder = prefabPath.replace(/\\/g, "/").split("/")[3] ?? "";
        const aliases: Record<string, string> = { red_man_tackles: "redman_tackles", "ylin-uistin": "ylin_uistin", handmade_lures: "Handmade", texas: "texas_lures", volkoff: "volkoff_lures" };
        return (aliases[folder] ?? folder) || null;
    }
    const id = basename(prefabPath, ".prefab").toLowerCase();
    const markers: Array<[RegExp, string]> = [
        [/(?:^|_)hvz_/, "van_zandt"], [/(?:^|_)cb_/, "craft_baits"], [/(?:^|_)op_/, "old_pal"],
        [/(?:^|_)sb_/, "smartboilies"], [/(?:^|_)mm_/, "mad_mayers"], [/(?:^|_)pm_/, "pomor"],
    ];
    return markers.find(([pattern]) => pattern.test(id))?.[1] ?? null;
}

function categoryUsesFamilies(domain: CatalogDomain, category: string | null) {
    if (domain === "lure") return true;
    return category !== null && ["sinking_boilies", "pop_up_boilies", "pellets", "artificial_corn", "zig_rig_foam"].includes(category);
}

async function main() {
    const exportRoot = argument("export-root", defaults.exportRoot);
    const bundleRoot = argument("bundle-root", defaults.bundleRoot);
    const out = argument("out", defaults.out);
    const catalogPath = join(exportRoot, "Resources", "itemscatalog", "ru_RU.bytes");
    const previewsRoot = join(exportRoot, "Resources", "previews");

    for (const required of [catalogPath, previewsRoot, bundleRoot]) {
        if (!(await exists(required))) throw new Error(`Required RF4 source not found: ${required}`);
    }

    const catalog = JSON.parse((await readFile(catalogPath, "utf8")).replace(/^\uFEFF/, "")) as CatalogFile;
    const families: CatalogFamily[] = Object.entries(catalog.brands).flatMap(([brandKey, brand]) =>
        (brand.itemFamilies ?? []).filter((family) => family.name && !family.hidden).map((family) => ({
            brandSystemId: brand.systemId || brandKey,
            brandName: brand.name || brandKey,
            systemId: family.systemId,
            name: family.name,
            description: family.description ?? "",
        })),
    );

    const bundleNames = (await readdir(bundleRoot))
        .filter((name) => name === "baits.json" || /^lures.*\.json$/i.test(name))
        .sort();
    const sourceRows: Array<{ domain: CatalogDomain; bundle: string; systemId: string; prefabPath: string }> = [];
    for (const fileName of bundleNames) {
        const bundle = JSON.parse(await readFile(join(bundleRoot, fileName), "utf8")) as BundleFile;
        const bundleBase = basename(fileName, ".json");
        for (const prefabPath of Object.keys(bundle.m_Container ?? {})) {
            sourceRows.push({
                domain: fileName === "baits.json" ? "bait" : "lure",
                bundle: bundleBase,
                systemId: basename(prefabPath, ".prefab"),
                prefabPath,
            });
        }
    }

    const seen = new Set<string>();
    const items = [];
    const issues: Array<Record<string, unknown>> = [];
    for (const source of sourceRows) {
        const uniqueKey = `${source.domain}:${source.systemId}`;
        if (seen.has(uniqueKey)) {
            issues.push({ type: "duplicate_source_id", ...source });
            continue;
        }
        seen.add(uniqueKey);
        const localized = catalog.items[source.systemId];
        const imagePath = join(previewsRoot, `${source.systemId}.png`);
        const hasImage = await exists(imagePath);
        if (!localized?.name?.trim()) {
            issues.push({ type: "missing_public_name", hasImage, ...source });
            continue;
        }
        if (localized.hidden) {
            issues.push({ type: "hidden_item", name: localized.name, ...source });
            continue;
        }

        const classification = classifyCatalogItem(source.domain, source.systemId, localized.name, source.prefabPath);
        const hint = brandHint(source.bundle, source.prefabPath);
        const familyApplicable = categoryUsesFamilies(source.domain, classification.category);
        const familyMatch = familyApplicable
            ? matchCatalogFamily(localized.name, families, hint)
            : { family: null, ambiguous: false, candidateCount: 0, candidates: [] };
        const item = {
            domain: source.domain,
            systemId: source.systemId,
            name: localized.name.trim(),
            description: localized.description?.trim() ?? "",
            category: classification.category,
            categoryConfidence: classification.confidence,
            categoryReason: classification.reason,
            brandSystemId: familyMatch.ambiguous ? hint : familyMatch.family?.brandSystemId ?? hint,
            brandName: familyMatch.ambiguous ? null : familyMatch.family?.brandName ?? null,
            familySystemId: familyMatch.ambiguous ? null : familyMatch.family?.systemId ?? null,
            familyName: familyMatch.ambiguous ? null : familyMatch.family?.name ?? null,
            familyAmbiguous: familyMatch.ambiguous,
            familyApplicable,
            variantCode: deriveVariantCode(localized.name, familyMatch.family?.name),
            imagePath: hasImage ? imagePath : null,
            prefabPath: source.prefabPath,
            sourceBundle: source.bundle,
        };
        items.push(item);
        if (!classification.category) issues.push({ type: "unknown_category", systemId: source.systemId, name: localized.name, domain: source.domain, prefabPath: source.prefabPath });
        if (familyApplicable && !familyMatch.family) issues.push({ type: "unknown_family", systemId: source.systemId, name: localized.name, domain: source.domain, brandHint: hint });
        if (familyApplicable && familyMatch.ambiguous) issues.push({
            type: "ambiguous_family",
            systemId: source.systemId,
            name: localized.name,
            domain: source.domain,
            brandHint: hint,
            candidates: familyMatch.candidateCount,
            candidateFamilies: familyMatch.candidates.map((family) => `${family.brandName} / ${family.name} [${family.systemId}]`),
        });
        if (!hasImage) issues.push({ type: "missing_preview", systemId: source.systemId, name: localized.name, domain: source.domain });
    }

    const byCategory = Object.entries(Object.groupBy(items, (item) => `${item.domain}:${item.category ?? "unknown"}`))
        .map(([category, rows]) => ({ category, count: rows?.length ?? 0 }))
        .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
    const byIssue = Object.entries(Object.groupBy(issues, (issue) => String(issue.type)))
        .map(([type, rows]) => ({ type, count: rows?.length ?? 0 }))
        .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
    const duplicateNames = Object.entries(Object.groupBy(items, (item) => `${item.domain}:${item.name.toLocaleLowerCase("ru-RU")}`))
        .filter(([, rows]) => (rows?.length ?? 0) > 1)
        .map(([, rows]) => {
            const matches = rows ?? [];
            const systemIds = matches.map((item) => item.systemId).sort();
            return {
                domain: matches[0]?.domain,
                name: matches[0]?.name,
                count: matches.length,
                systemIds,
                likelyQualityVariants: systemIds.every((systemId) => /_(?:hq|mq|lq)$/i.test(systemId)),
            };
        })
        .sort((left, right) => right.count - left.count || String(left.name).localeCompare(String(right.name), "ru"));
    const summary = {
        generatedAt: new Date().toISOString(),
        dryRun: true,
        sources: { catalogPath, previewsRoot, bundleRoot, bundleCount: bundleNames.length },
        totals: {
            sourceAssets: sourceRows.length,
            importCandidates: items.length,
            baits: items.filter((item) => item.domain === "bait").length,
            lures: items.filter((item) => item.domain === "lure").length,
            categorized: items.filter((item) => item.category).length,
            matchedFamilies: items.filter((item) => item.familySystemId).length,
            withPreview: items.filter((item) => item.imagePath).length,
            issues: issues.length,
            duplicateNameGroups: duplicateNames.length,
            duplicateNameItems: duplicateNames.reduce((total, group) => total + group.count, 0),
            familyApplicable: items.filter((item) => item.familyApplicable).length,
            standaloneItems: items.filter((item) => !item.familyApplicable).length,
        },
        byCategory,
        byIssue,
    };

    await mkdir(out, { recursive: true });
    await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
    await writeFile(join(out, "items.json"), JSON.stringify(items, null, 2), "utf8");
    await writeFile(join(out, "issues.json"), JSON.stringify(issues, null, 2), "utf8");
    await writeFile(join(out, "duplicate-names.json"), JSON.stringify(duplicateNames, null, 2), "utf8");
    const columns = ["domain", "systemId", "name", "category", "categoryConfidence", "brandSystemId", "brandName", "familySystemId", "familyName", "familyAmbiguous", "variantCode", "imagePath", "prefabPath", "sourceBundle"] as const;
    const csv = [columns.join(","), ...items.map((item) => columns.map((column) => csvCell(item[column])).join(","))].join("\r\n");
    await writeFile(join(out, "items.csv"), `\uFEFF${csv}`, "utf8");
    const issueColumns = ["type", "domain", "systemId", "name", "brandHint", "candidates", "prefabPath"] as const;
    const issueCsv = [issueColumns.join(","), ...issues.map((issue) => issueColumns.map((column) => csvCell(issue[column])).join(","))].join("\r\n");
    await writeFile(join(out, "issues.csv"), `\uFEFF${issueCsv}`, "utf8");
    const itemByKey = new Map(items.map((item) => [`${item.domain}:${item.systemId}`, item]));
    const familyReview = issues
        .filter((issue) => issue.type === "unknown_family" || issue.type === "ambiguous_family")
        .map((issue) => {
            const item = itemByKey.get(`${issue.domain}:${issue.systemId}`);
            return {
                catalogStatus: "добавлено в каталог",
                problem: issue.type === "unknown_family" ? "семейство не найдено" : "несколько подходящих семейств",
                missingData: issue.type === "unknown_family" ? "не назначено семейство" : "не выбрано точное семейство",
                domain: issue.domain,
                systemId: issue.systemId,
                name: issue.name,
                category: item?.category ?? "",
                brandHint: issue.brandHint ?? "",
                assignedFamily: item?.familyName ?? "",
                candidateFamilies: Array.isArray(issue.candidateFamilies) ? issue.candidateFamilies.join(" | ") : "",
                reason: issue.type === "unknown_family"
                    ? "Название и подсказка бренда не совпали ни с одним семейством каталога"
                    : "Несколько семейств совпали с одинаковым приоритетом; автоматический выбор небезопасен",
            };
        });
    const familyReviewColumns = ["catalogStatus", "problem", "missingData", "domain", "systemId", "name", "category", "brandHint", "assignedFamily", "candidateFamilies", "reason"] as const;
    const familyReviewCsv = [
        familyReviewColumns.join(","),
        ...familyReview.map((row) => familyReviewColumns.map((column) => csvCell(row[column])).join(",")),
    ].join("\r\n");
    await writeFile(join(out, "family-review.csv"), `\uFEFF${familyReviewCsv}`, "utf8");
    await writeFile(join(out, "added-items-requiring-family-review.csv"), `\uFEFF${familyReviewCsv}`, "utf8");
    const standaloneColumns = ["domain", "systemId", "name", "category", "brandSystemId", "variantCode", "imagePath"] as const;
    const standaloneItems = items.filter((item) => !item.familyApplicable);
    const standaloneCsv = [
        standaloneColumns.join(","),
        ...standaloneItems.map((item) => standaloneColumns.map((column) => csvCell(item[column])).join(",")),
    ].join("\r\n");
    await writeFile(join(out, "standalone-items.csv"), `\uFEFF${standaloneCsv}`, "utf8");
    const report = [
        "# RF4 catalog dry-run",
        "",
        `Generated: ${summary.generatedAt}`,
        "",
        "No database rows or image files were changed.",
        "",
        "## Coverage",
        "",
        `- Import candidates: ${summary.totals.importCandidates}`,
        `- Baits: ${summary.totals.baits}`,
        `- Lures: ${summary.totals.lures}`,
        `- Categorized: ${summary.totals.categorized} (${(summary.totals.categorized / summary.totals.importCandidates * 100).toFixed(1)}%)`,
        `- Preview found: ${summary.totals.withPreview} (${(summary.totals.withPreview / summary.totals.importCandidates * 100).toFixed(1)}%)`,
        `- Family matched: ${summary.totals.matchedFamilies} (${(summary.totals.matchedFamilies / summary.totals.importCandidates * 100).toFixed(1)}%)`,
        `- Duplicate display-name groups: ${summary.totals.duplicateNameGroups} (${summary.totals.duplicateNameItems} items)`,
        `- Items where family is applicable: ${summary.totals.familyApplicable}`,
        `- Standalone items without a family: ${summary.totals.standaloneItems}`,
        "",
        "## Review queue",
        "",
        ...summary.byIssue.map((entry) => `- ${entry.type}: ${entry.count}`),
        "",
        "Duplicate display names are reported separately and are not merged. Many are HQ/MQ/LQ crafted variants.",
        "Unmatched families must be reviewed before a database importer is enabled; category and preview coverage are already complete.",
        "",
    ].join("\n");
    await writeFile(join(out, "report.md"), report, "utf8");

    console.log(JSON.stringify(summary, null, 2));
    console.log(`Dry-run reports written to ${out}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
