import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db";
import { fishMediaRoot } from "../src/lib/uploads";
import { csvCell } from "../src/lib/rf4-catalog-dry-run";

type CatalogItem = { systemId: string; name: string; hidden?: boolean };
type CatalogFile = { items: Record<string, CatalogItem> };
type FishRow = { id: number; name: string };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..", "..");
const defaultExportRoot = "C:\\Users\\danil\\Desktop\\rr4\\RepeatAllFilesCopy\\AssetRipper_export_20260621_111439\\Assets";
const defaultOut = join(projectRoot, "artifacts", "rf4-fish-images");

const cardAliases: Record<string, string> = {
    "Валёк": "card_valyok", "Дрейссена речная": "card_dreissena",
    "Карп Динкенбюльский голый": "card_din_n_carp", "Карп Динкенбюльский зеркальный": "card_din_m_carp",
    "Карп Динкенбюльский линейный": "card_din_l_carp", "Карп зеркальный - призрак": "card_m_carp_ghost",
    "Карп красный Старвас - зеркальный": "card_m_carp_red", "Карп красный Старвас - чешуйчатый": "card_carp_red",
    "Карп чешуйчатый": "card_carp", "Карп чешуйчатый - альбинос": "card_carp_albino",
    "Карп чешуйчатый - призрак": "card_carp_ghost", "Краснопёр-Угай крупночешуйчатый": "card_trib_h",
    "Линь Квольсдорфский": "card_kw_tench", "Меч-рыба": "card_x_gladius",
    "Подкаменщик сибирский": "card_bullhead_syb", "Сиг чёрный": "card_sig_black",
    "Сима": "card_onkor_m", "Сима жилая": "card_onkor_mg", "Усач альбинос": "card_alb_barbel",
    "Устрица съедобная": "card_ostrea_ed", "Шемая черноморская": "card_shemaya_cha",
};

function argument(name: string, fallback: string) {
    const index = process.argv.indexOf(`--${name}`);
    return resolve(index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback);
}

function normalizeName(value: string) {
    return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[–—-]/g, " ")
        .replace(/[^а-яa-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

async function exists(path: string) {
    try { await access(path); return true; } catch { return false; }
}

async function findFishPreview(previewsRoot: string, cardSystemId: string) {
    const base = cardSystemId.replace(/^card_/, "");
    const candidates = [`${base}_b.png`, `${base.replace("_", ".")}_b.png`];
    for (const name of candidates) {
        const path = join(previewsRoot, name);
        if (await exists(path)) return { name, path };
    }
    return null;
}

async function copyIfChanged(source: string, target: string) {
    const sourceInfo = await stat(source);
    const targetInfo = await stat(target).catch(() => null);
    if (targetInfo?.size === sourceInfo.size) return false;
    await copyFile(source, target);
    return true;
}

async function main() {
    const exportRoot = argument("export-root", defaultExportRoot);
    const out = argument("out", defaultOut);
    const apply = process.argv.includes("--apply");
    const catalogPath = join(exportRoot, "Resources", "itemscatalog", "ru_RU.bytes");
    const previewsRoot = join(exportRoot, "Resources", "previews");
    const catalog = JSON.parse((await readFile(catalogPath, "utf8")).replace(/^\uFEFF/, "")) as CatalogFile;
    const catalogById = new Map(Object.values(catalog.items).map((item) => [item.systemId, item]));
    const cardsByName = new Map<string, CatalogItem[]>();
    for (const item of Object.values(catalog.items)) {
        if (!item.name || item.hidden || !item.systemId.startsWith("card_")) continue;
        const key = normalizeName(item.name);
        cardsByName.set(key, [...(cardsByName.get(key) ?? []), item]);
    }

    const fish = await pool.query<FishRow>(`SELECT id, name FROM fish ORDER BY name`);
    const mappings = [];
    const errors: string[] = [];
    for (const row of fish.rows) {
        const aliasId = cardAliases[row.name];
        const exact = cardsByName.get(normalizeName(row.name)) ?? [];
        const card = aliasId ? catalogById.get(aliasId) : exact.length === 1 ? exact[0] : null;
        if (!card) { errors.push(`${row.name}: fish card id not found`); continue; }
        const preview = await findFishPreview(previewsRoot, card.systemId);
        if (!preview) { errors.push(`${row.name}: clean fish preview not found for ${card.systemId}`); continue; }
        mappings.push({
            fishId: row.id, fishName: row.name, cardSystemId: card.systemId, catalogName: card.name,
            imageFile: preview.name, imagePath: preview.path, photoUrl: `/uploads/fish/${preview.name}`,
            match: aliasId ? "alias" : "normalized_exact",
        });
    }

    await mkdir(out, { recursive: true });
    await writeFile(join(out, "mapping.json"), JSON.stringify({ generatedAt: new Date().toISOString(), exportRoot, mappings, errors }, null, 2), "utf8");
    const columns = ["fishId", "fishName", "cardSystemId", "catalogName", "imageFile", "match", "imagePath", "photoUrl"] as const;
    const csv = [columns.join(","), ...mappings.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
    await writeFile(join(out, "mapping.csv"), `\uFEFF${csv}`, "utf8");
    if (errors.length || mappings.length !== fish.rows.length) throw new Error(`Fish image mapping incomplete (${mappings.length}/${fish.rows.length}):\n${errors.join("\n")}`);

    if (!apply) {
        console.log(JSON.stringify({ dryRun: true, fish: fish.rows.length, mapped: mappings.length, aliases: mappings.filter((item) => item.match === "alias").length, errors: 0, out }, null, 2));
        return;
    }

    await mkdir(fishMediaRoot, { recursive: true });
    let copiedImages = 0;
    for (let offset = 0; offset < mappings.length; offset += 32) {
        const copied = await Promise.all(mappings.slice(offset, offset + 32).map((item) => copyIfChanged(item.imagePath, join(fishMediaRoot, item.imageFile))));
        copiedImages += copied.filter(Boolean).length;
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (const item of mappings) await client.query(`UPDATE fish SET photo=$1 WHERE id=$2`, [item.photoUrl, item.fishId]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
    } finally { client.release(); }
    await writeFile(join(fishMediaRoot, "source-manifest.json"), JSON.stringify({ importedAt: new Date().toISOString(), exportRoot, fishCount: mappings.length }, null, 2), "utf8");
    console.log(JSON.stringify({ dryRun: false, applied: true, fish: mappings.length, copiedImages }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => pool.end());
