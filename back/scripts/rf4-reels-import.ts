import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db";
import { reelMediaRoot } from "../src/lib/uploads";

type ReelRow = {
    name: string;
    category: string;
    brend: string;
    size: number | null;
    test: string;
    test_mod: string | null;
    protection: boolean;
    per: string;
    per_mod: string | null;
    speed: string;
    speed_mod: string | null;
    frik: string;
    frik_mod: string | null;
    meh: string;
    meh_mod: string | null;
    lvl: number | null;
    price_ser: string | null;
    price_gold: string | null;
    capacity: string | null;
    capacity_mod: string | null;
    system_id: string;
    photo: string;
    source_url: string;
};

const pages = [
    { category: "Байткастинговые", id: "113477646", count: 46, columns: 17 },
    { category: "Безинерционные", id: "110667406", count: 236, columns: 16 },
    { category: "Силовые", id: "113477996", count: 78, columns: 15 },
    { category: "Низкопрофильные", id: "113478266", count: 35, columns: 15 },
] as const;

const exportRoot = process.env.RF4_EXPORT_ROOT
    ?? "C:/Users/danil/Desktop/rr4/RepeatAllFilesCopy/AssetRipper_export_20260621_111439/Assets";
const previewRoot = join(exportRoot, "Resources", "previews");
const catalogPath = join(exportRoot, "Resources", "itemscatalog", "ru_RU.bytes");
const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const artifactRoot = join(scriptDir, "..", "..", "artifacts", "rf4-reels-import");

// The source uses a few shortened, misspelled, or generic names compared with RF4's catalog.
const aliases: Record<string, string> = {
    "Minister CS ES60": "bcr_5462",
    "Phantom Super": "bcr_6013",
    "Monster LD60": "bcr_5366",
    "Minister CS LD60": "bcr_5460",
    "Minister CS PG60": "bcr_5458",
    "Minister CS SR60": "bcr_5459",
    "Minister CS SG60": "bcr_5456",
    "Billionare HV 60R": "bcr_5048",
    "ZM-4 Z-60 8-Years": "bcr_5723",
    "ZM-4 Z-40 8-Years": "bcr_5717",
    "Castmaster LGR1973": "bcr_5764",
    "Billionare 60R": "bcr_5070",
    "Billionare 50R": "bcr_5008",
    "Venga II 10000 Final": "spin_6042",
    "Venga 10000 6 An.": "spin_5928",
    "Tagara II 10000 8-An.": "spin_5719",
    "Major ltd 2 6000s": "spin_5216",
    "Major ltd 2 4000s": "spin_5215",
    "Major 2 4000s": "spin_5213",
    "Hunter 40S": "spin_7014",
    "Mayor III 3000S + 9 Years": "spin_6115_g",
    "Major III 2000S": "spin_6114",
    "Major 2 2000s": "spin_5212",
    "Conquest II 2000": "spin_5316",
    "Pelengas 2026": "spinreel_pelengas_2026",
    "Major III 1000S": "spin_6113",
    "Borealica 40DS": "conv_5972",
    "Borealica 30DS": "conv_5313",
    "Borealica 20DS": "conv_5312",
    "Imperial C40 2S": "conv_5174",
    "Triumph 30 2S 8-An.": "conv_5718",
    "Venga C 40 2S 9-An.": "conv_7008",
    "Taiga 40 2S": "conv_5170",
    "Taiga 20 2S": "conv_5169",
    "Tera C-LW 40": "conv_5165",
    "Tera C-LW 30LC": "conv_5164",
    "Tera C-LW 30": "conv_5163",
    "Tera C-LW 20": "conv_5162",
    "Taiga C 30 2S 7-An.": "conv_6015",
    "Hamra C-LW 30": "conv_5148",
    "Hamra C-LW 20": "conv_5146",
    "Hamra C-LW 10": "conv_5145",
    "Narga C-LW 30": "conv_5144",
    "Narga C-LW 20": "conv_5143",
    "Narga C-LW 10": "conv_5142",
    "Zodiac С-20": "conv_5394",
    "Zodiac С-10": "conv_5393",
    "Opyimus": "bclp_5339",
};

function decodeHtml(value: string) {
    return value
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .trim();
}

function optional(value: string | undefined) {
    const trimmed = value?.trim() ?? "";
    return trimmed && trimmed !== "-" && trimmed !== "?" ? trimmed : null;
}

function required(value: string | undefined) {
    return value?.trim() || "-";
}

function integer(value: string | undefined) {
    const parsed = Number(value?.replace(/\s/g, ""));
    return Number.isInteger(parsed) ? parsed : null;
}

function normalizeName(value: string) {
    return value
        .normalize("NFKC")
        .toLocaleLowerCase("ru")
        .replace(/[сc]/g, "c")
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9]+/g, "");
}

async function parsePage(page: typeof pages[number]) {
    const sourceUrl = `https://potryasovgame.ru/page${page.id}.html`;
    const response = await fetch(`https://r.jina.ai/http://potryasovgame.ru/page${page.id}.html`, {
        headers: { "X-Return-Format": "html" },
    });
    if (!response.ok) throw new Error(`Не удалось загрузить ${sourceUrl}: HTTP ${response.status}`);
    const html = await response.text();
    const cellPattern = /role="gridcell"\s+col-id="field_(\d+)"[\s\S]*?<span[^>]*class="ag-cell-value"[^>]*>([\s\S]*?)<\/span>/g;
    const rows: string[][] = [];
    let row: string[] = [];
    for (const match of html.matchAll(cellPattern)) {
        const index = Number(match[1]);
        if (index === 0 && row.length) {
            rows.push(row);
            row = [];
        }
        row[index] = decodeHtml(match[2]);
    }
    if (row.length) rows.push(row);
    if (rows.length !== page.count || rows.some((cells) => cells.length !== page.columns)) {
        throw new Error(`${page.category}: ожидалось ${page.count}x${page.columns}, получено ${rows.length} строк`);
    }
    return { rows, sourceUrl };
}

function mapCells(category: string, c: string[], sourceUrl: string): Omit<ReelRow, "system_id" | "photo"> {
    const common = { name: required(c[0]), category, brend: required(c[1]), source_url: sourceUrl };
    if (category === "Байткастинговые") return {
        ...common, size: integer(c[2]), protection: c[3] === "Да", test: required(c[4]), test_mod: optional(c[5]),
        per: required(c[6]), per_mod: optional(c[7]), speed: required(c[8]), speed_mod: optional(c[9]),
        frik: required(c[10]), frik_mod: optional(c[11]), meh: required(c[12]), meh_mod: optional(c[13]),
        lvl: integer(c[14]), price_ser: optional(c[15]), price_gold: optional(c[16]), capacity: null, capacity_mod: null,
    };
    if (category === "Безинерционные") return {
        ...common, size: integer(c[2]), test: required(c[3]), test_mod: null, protection: c[4] === "Да",
        per: required(c[5]), per_mod: optional(c[6]), speed: required(c[7]), speed_mod: optional(c[8]),
        frik: required(c[9]), frik_mod: optional(c[10]), meh: required(c[11]), meh_mod: optional(c[12]),
        lvl: integer(c[13]), price_ser: optional(c[14]), price_gold: optional(c[15]), capacity: null, capacity_mod: null,
    };
    if (category === "Силовые") return {
        ...common, size: integer(c[2]), protection: c[3] === "Да", test: required(c[4]), test_mod: null,
        per: required(c[5]), per_mod: optional(c[6]), speed: required(c[7]), speed_mod: optional(c[8]),
        frik: required(c[9]), frik_mod: null, capacity: optional(c[10]), capacity_mod: optional(c[11]),
        meh: required(c[12]), meh_mod: null, lvl: null, price_ser: optional(c[13]), price_gold: optional(c[14]),
    };
    return {
        ...common, size: null, protection: false, test: required(c[2]), test_mod: optional(c[3]),
        per: required(c[4]), per_mod: optional(c[5]), speed: required(c[6]), speed_mod: optional(c[7]),
        frik: required(c[8]), frik_mod: optional(c[9]), meh: required(c[10]), meh_mod: optional(c[11]),
        lvl: integer(c[12]), price_ser: optional(c[13]), price_gold: optional(c[14]), capacity: null, capacity_mod: null,
    };
}

function csvCell(value: unknown) {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
    const catalog = JSON.parse((await readFile(catalogPath, "utf8")).replace(/^\uFEFF/, ""));
    const catalogItems = Object.values(catalog.items ?? {}) as Array<{ systemId: string; name: string }>;
    const normalizedAliases = new Map(Object.entries(aliases).map(([name, systemId]) => [normalizeName(name), systemId]));
    const exact = new Map<string, Array<{ systemId: string; name: string }>>();
    for (const item of catalogItems) {
        const key = normalizeName(item.name);
        exact.set(key, [...(exact.get(key) ?? []), item]);
    }

    const records: ReelRow[] = [];
    const resolutions: Array<{ sourceName: string; catalogName: string; systemId: string; method: string }> = [];
    const issues: Array<{ name: string; reason: string }> = [];
    for (const page of pages) {
        const { rows, sourceUrl } = await parsePage(page);
        for (const cells of rows) {
            const base = mapCells(page.category, cells, sourceUrl);
            // Potryasov duplicates the DS label here; RF4 has separate DS and non-DS models.
            if (base.name === "Tongar 2Gen 20 DS" && base.per === "6,4:1") base.name = "Tongar 2Gen 20";
            const aliasId = normalizedAliases.get(normalizeName(base.name));
            const candidates = exact.get(normalizeName(base.name)) ?? [];
            const systemId = aliasId ?? (candidates.length === 1 ? candidates[0].systemId : null);
            const catalogItem = systemId ? catalogItems.find((item) => item.systemId === systemId) : undefined;
            const preview = systemId ? join(previewRoot, `${systemId}.png`) : null;
            if (!systemId || !catalogItem || !preview) {
                issues.push({ name: base.name, reason: !systemId ? `совпадений: ${candidates.length}` : "нет записи каталога" });
                continue;
            }
            try {
                await readFile(preview);
            } catch {
                issues.push({ name: base.name, reason: `нет превью ${basename(preview)}` });
                continue;
            }
            records.push({ ...base, system_id: systemId, photo: `/uploads/reels/${systemId}.png` });
            resolutions.push({ sourceName: base.name, catalogName: catalogItem.name, systemId, method: aliasId ? "alias" : "exact" });
        }
    }

    await mkdir(artifactRoot, { recursive: true });
    await writeFile(join(artifactRoot, "mapping.json"), JSON.stringify(resolutions, null, 2), "utf8");
    await writeFile(join(artifactRoot, "issues.json"), JSON.stringify(issues, null, 2), "utf8");
    const headers = Object.keys(records[0] ?? {});
    await writeFile(join(artifactRoot, "reels.csv"), [headers.join(","), ...records.map((row) => headers.map((key) => csvCell(row[key as keyof ReelRow])).join(","))].join("\n"), "utf8");

    const expected = pages.reduce((sum, page) => sum + page.count, 0);
    if (issues.length || records.length !== expected) {
        throw new Error(`Импорт остановлен: готово ${records.length}/${expected}, проблем ${issues.length}. См. ${artifactRoot}`);
    }

    const duplicateNames = records.filter((row, index) => records.findIndex((other) => other.name === row.name) !== index);
    const duplicateIds = records.filter((row, index) => records.findIndex((other) => other.system_id === row.system_id) !== index);
    if (duplicateNames.length || duplicateIds.length) throw new Error(`Дубликаты: names=${duplicateNames.length}, systemIds=${duplicateIds.length}`);

    if (!process.argv.includes("--apply")) {
        console.log(`Dry run: ${records.length} катушек, ${resolutions.filter((x) => x.method === "alias").length} алиасов, 0 проблем.`);
        console.log(`Отчёт: ${artifactRoot}`);
        return;
    }

    await mkdir(reelMediaRoot, { recursive: true });
    for (const row of records) await copyFile(join(previewRoot, `${row.system_id}.png`), join(reelMediaRoot, `${row.system_id}.png`));

    const columns = Object.keys(records[0]);
    const updates = columns.filter((column) => column !== "name").map((column) => `"${column}" = EXCLUDED."${column}"`).join(", ");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (const row of records) {
            await client.query(
                `INSERT INTO reels (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (name) DO UPDATE SET ${updates}`,
                columns.map((column) => row[column as keyof ReelRow]),
            );
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
    console.log(`Импортировано: ${records.length} катушек и ${records.length} изображений.`);
}

main().catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
});
