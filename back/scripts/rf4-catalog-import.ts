import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db";
import { runMigrations } from "../src/lib/migrations";
import { catalogMediaRoot } from "../src/lib/uploads";

type CatalogItem = {
    domain: "bait" | "lure";
    systemId: string;
    name: string;
    description: string;
    category: string;
    brandSystemId: string | null;
    brandName: string | null;
    familySystemId: string | null;
    familyName: string | null;
    familyAmbiguous: boolean;
    familyApplicable: boolean;
    variantCode: string | null;
    imagePath: string;
    prefabPath: string;
    sourceBundle: string;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..", "..");
const defaultInput = join(projectRoot, "artifacts", "rf4-catalog-dry-run", "items.json");

function argument(name: string, fallback: string) {
    const index = process.argv.indexOf(`--${name}`);
    return resolve(index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback);
}

function legacyKind(item: CatalogItem) {
    if (item.domain === "lure") return "artificial_lure";
    if (["sinking_boilies", "pop_up_boilies"].includes(item.category)) return "boilie";
    if (item.category === "pellets") return "pellet";
    if (item.category === "marine_bait") return "marine";
    if (["natural", "nuts", "worms", "larvae", "insects", "crustaceans", "live", "live_fish", "dead_fish", "fish_fillet"].includes(item.category)) return "natural";
    return "prepared";
}

function quality(systemId: string) {
    const match = systemId.match(/_(hq|mq|lq)$/i);
    return match?.[1]?.toLowerCase() ?? null;
}

async function copyIfChanged(source: string, target: string) {
    const sourceInfo = await stat(source);
    const targetInfo = await stat(target).catch(() => null);
    if (targetInfo?.size === sourceInfo.size) return false;
    await copyFile(source, target);
    return true;
}

async function copyImages(items: CatalogItem[]) {
    await mkdir(catalogMediaRoot, { recursive: true });
    let copied = 0;
    for (let offset = 0; offset < items.length; offset += 32) {
        const batch = items.slice(offset, offset + 32);
        const results = await Promise.all(batch.map(async (item) => {
            const target = join(catalogMediaRoot, `${item.systemId}.png`);
            return copyIfChanged(item.imagePath, target);
        }));
        copied += results.filter(Boolean).length;
    }
    return copied;
}

async function applyImport(items: CatalogItem[], input: string) {
    await runMigrations();
    const copiedImages = await copyImages(items);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const brandIds = new Map<string, number>();
        const familyIds = new Map<string, number>();

        for (const item of items) {
            if (!item.brandSystemId || !item.brandName || brandIds.has(item.brandSystemId)) continue;
            const { rows } = await client.query<{ id: number }>(
                `INSERT INTO bait_brand (system_id, name) VALUES ($1, $2)
                 ON CONFLICT (system_id) DO UPDATE SET name=EXCLUDED.name, updated_at=NOW()
                 RETURNING id`,
                [item.brandSystemId, item.brandName],
            );
            brandIds.set(item.brandSystemId, rows[0].id);
        }

        for (const item of items) {
            if (item.familyAmbiguous || !item.brandSystemId || !item.familySystemId || !item.familyName) continue;
            const brandId = brandIds.get(item.brandSystemId);
            const key = `${item.brandSystemId}:${item.familySystemId}`;
            if (!brandId || familyIds.has(key)) continue;
            const { rows } = await client.query<{ id: number }>(
                `INSERT INTO bait_family (brand_id, system_id, name) VALUES ($1, $2, $3)
                 ON CONFLICT (brand_id, system_id) DO UPDATE SET name=EXCLUDED.name, updated_at=NOW()
                 RETURNING id`,
                [brandId, item.familySystemId, item.familyName],
            );
            familyIds.set(key, rows[0].id);
        }

        for (const item of items) {
            const familyId = !item.familyAmbiguous && item.brandSystemId && item.familySystemId
                ? familyIds.get(`${item.brandSystemId}:${item.familySystemId}`) ?? null
                : null;
            await client.query(
                `INSERT INTO bait (
                    system_id, name, kind, domain, category_code, family_id, source_brand_hint, variant_code, quality,
                    description, photo, is_active, source, source_bundle, prefab_path
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,'rf4_catalog',$12,$13)
                 ON CONFLICT (domain, system_id) DO UPDATE SET
                    name=EXCLUDED.name, kind=EXCLUDED.kind, category_code=EXCLUDED.category_code,
                    family_id=EXCLUDED.family_id, source_brand_hint=EXCLUDED.source_brand_hint,
                    variant_code=EXCLUDED.variant_code, quality=EXCLUDED.quality, description=EXCLUDED.description,
                    photo=EXCLUDED.photo, source='rf4_catalog', source_bundle=EXCLUDED.source_bundle,
                    prefab_path=EXCLUDED.prefab_path, updated_at=NOW()`,
                [
                    item.systemId, item.name, legacyKind(item), item.domain, item.category, familyId,
                    item.brandSystemId, item.variantCode, quality(item.systemId), item.description || null,
                    `/uploads/catalog/${item.systemId}.png`, item.sourceBundle, item.prefabPath,
                ],
            );
        }

        const importedCount = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM bait WHERE source='rf4_catalog'`);
        const duplicateKeys = await client.query<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM (SELECT domain, system_id FROM bait WHERE system_id IS NOT NULL GROUP BY domain, system_id HAVING COUNT(*) > 1) duplicates`,
        );
        await client.query("COMMIT");
        await writeFile(join(catalogMediaRoot, "source-manifest.json"), JSON.stringify({
            importedAt: new Date().toISOString(),
            input,
            itemCount: items.length,
            source: "Local RF4 AssetRipper export",
        }, null, 2), "utf8");
        return {
            copiedImages,
            brands: brandIds.size,
            families: familyIds.size,
            processedItems: items.length,
            importedItemsInDatabase: importedCount.rows[0]?.count ?? 0,
            duplicateSystemKeys: duplicateKeys.rows[0]?.count ?? 0,
        };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    const input = argument("input", defaultInput);
    const apply = process.argv.includes("--apply");
    const items = JSON.parse(await readFile(input, "utf8")) as CatalogItem[];
    const errors: string[] = [];
    const ids = new Set<string>();

    for (const item of items) {
        const key = `${item.domain}:${item.systemId}`;
        if (ids.has(key)) errors.push(`Duplicate source key: ${key}`);
        ids.add(key);
        if (!/^[A-Za-z0-9_-]+$/.test(item.systemId)) errors.push(`Unsafe system id: ${item.systemId}`);
        if (!item.category) errors.push(`Missing category: ${key}`);
        if (!item.imagePath) errors.push(`Missing image path: ${key}`);
    }
    if (errors.length) throw new Error(`Catalog validation failed:\n${errors.slice(0, 20).join("\n")}`);

    if (!apply) {
        console.log(JSON.stringify({ dryRun: true, valid: true, items: items.length, uniqueKeys: ids.size, input }, null, 2));
        console.log("No database rows or files were changed. Pass --apply to import.");
        return;
    }

    const result = await applyImport(items, input);
    console.log(JSON.stringify({ dryRun: false, applied: true, ...result }, null, 2));
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
