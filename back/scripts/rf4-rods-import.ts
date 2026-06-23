// Imports rods from potryasovgame.ru pages (which publish their data as public Google Sheets CSV)
// and matches each row to the game catalogue for the `system_id` and the .png preview image.
//
// Run dry: `npm run rods:import`
// Apply:   `npm run rods:import -- --apply`

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db";
import { rodMediaRoot } from "../src/lib/uploads";

// One entry per source page → CSV mapping. Counts are diagnostic only.
const pages = [
    {
        category: "Спиннинговые",
        sourceUrl: "https://potryasovgame.ru/page110667676.html",
        csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZjZiFBUN5pOABRHG6q4j2Zvd0A499Hz-5lYXv5bNKRkQMazlM-LwhUJaI0TrRy5Gc5YZLwzTPTHCE/pub?gid=316501810&single=true&output=csv",
    },
    {
        category: "Поплавочные",
        sourceUrl: "https://potryasovgame.ru/page113839636.html",
        csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKSW5tVNIFt_6zLUPCs0nNr2LaG-_Oomso6anu6KPDVcvry0Gj_s9m8LKoc_voiJcG3q-Gj5lq_iJr/pub?gid=124107689&single=true&output=csv",
    },
    {
        category: "Доночные",
        sourceUrl: "https://potryasovgame.ru/page113839786.html",
        csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSruWm4K3mu22BjAVGEOQE_fR6gB9WtQrr2RFA0pZ2EpEanUEsSLh_io7QjdZ46Z_TQFrYqcRzD8orC/pub?gid=578329911&single=true&output=csv",
    },
    {
        category: "Морские",
        sourceUrl: "https://potryasovgame.ru/page113840266.html",
        csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSCbju33KYQqmTdu4cMo5ht1x_QzWi-4pCMFIamyADJznCHLik-NenxCuQgIUXrjvbseDATR1xz3h-u/pub?gid=316501810&single=true&output=csv",
    },
] as const;

const exportRoot = process.env.RF4_EXPORT_ROOT
    ?? "C:/Users/danil/Desktop/rr4/RepeatAllFilesCopy/AssetRipper_export_20260621_111439/Assets";
const previewRoot = join(exportRoot, "Resources", "previews");
const catalogPath = join(exportRoot, "Resources", "itemscatalog", "ru_RU.bytes");

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const artifactRoot = join(scriptDir, "..", "..", "artifacts", "rf4-rods-import");

// Hand-curated aliases for rows whose name on potryasovgame doesn't exactly match the game catalogue.
// Found by running dry-run + cross-referencing catalog entries.
const aliases: Record<string, string> = {
    // Float — potryasov shortens "Falcon TL 800" → "Falcon 800"
    "Falcon 800": "tele_10084_TL800",
    "Falcon 600": "tele_10084_TL600",
    "Falcon 400": "tele_10084_TL400",
    "Expression 700": "tele_10177_TL700",
    "Expression 500": "tele_10177_TL500",
    // Sea — potryasov omits "Fjord"
    "Saltmaster - Ultra 88": "pilkr_10208_fu88",
};

type RodRow = {
    name: string;
    category: string;
    brend: string;
    type: string;
    power: string | null;
    test_down: string | null;
    test_up: string | null;
    length: string | null;
    sensi: string | null;
    rig: string | null;
    stroy: string | null;
    bonus_opit: string | null;
    bonus_snast: string | null;
    bonus_nav: string | null;
    bonus_zabros: string | null;
    stren: string | null;
    lvl: number | null;
    price_ser: string | null;
    price_gold: string | null;
    system_id: string;
    photo: string;
    source_url: string;
};

// --- Helpers -------------------------------------------------------------

function parseCsv(text: string): string[][] {
    const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
    const rows: string[][] = [];
    for (const line of lines) {
        const cells: string[] = [];
        let cur = "";
        let inQ = false;
        for (let i = 0; i < line.length; i += 1) {
            const c = line[i];
            if (c === '"') {
                if (inQ && line[i + 1] === '"') {
                    cur += '"';
                    i += 1;
                } else {
                    inQ = !inQ;
                }
            } else if (c === "," && !inQ) {
                cells.push(cur);
                cur = "";
            } else {
                cur += c;
            }
        }
        cells.push(cur);
        rows.push(cells);
    }
    return rows;
}

// Russian text needs canonicalisation to make Cyrillic/Latin lookalikes match.
function normalizeName(value: string): string {
    return value
        .normalize("NFKC")
        .toLocaleLowerCase("ru")
        .replace(/[сc]/g, "c")
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9]+/g, "");
}

function optional(value: string | undefined): string | null {
    const trimmed = value?.trim() ?? "";
    return trimmed && trimmed !== "-" && trimmed !== "?" ? trimmed : null;
}

function integer(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}

// Brand is the leading word(s) of the rod name. When the first token is a short tag like "7" or "Mr."
// take two tokens — otherwise multi-word brands ("7 Seas", "Model One", "Mr. Don") become unreadable.
function extractBrand(name: string): string {
    const tokens = name.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return "—";
    if (tokens.length >= 2 && (tokens[0].length <= 3 || /^[\d.]/.test(tokens[0]))) {
        return `${tokens[0]} ${tokens[1]}`;
    }
    return tokens[0];
}

// Pick the row value by header name, regardless of column order across pages.
function makeReader(header: string[]) {
    const indexOf = (matcher: RegExp): number => header.findIndex((h) => matcher.test(h));
    return (row: string[], matcher: RegExp): string | undefined => {
        const idx = indexOf(matcher);
        return idx >= 0 ? row[idx] : undefined;
    };
}

function csvCell(value: unknown): string {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// --- Main ---------------------------------------------------------------

async function main() {
    const catalogJson = (await readFile(catalogPath, "utf8")).replace(/^﻿/, "");
    const catalogItems = Object.values((JSON.parse(catalogJson) as { items: Record<string, { systemId: string; name: string }> }).items);
    const normalizedAliases = new Map(Object.entries(aliases).map(([name, id]) => [normalizeName(name), id]));
    const exactByName = new Map<string, Array<{ systemId: string; name: string }>>();
    for (const item of catalogItems) {
        const k = normalizeName(item.name);
        exactByName.set(k, [...(exactByName.get(k) ?? []), item]);
    }

    const records: RodRow[] = [];
    const issues: Array<{ category: string; name: string; reason: string }> = [];
    const resolutions: Array<{ sourceName: string; catalogName: string; systemId: string; method: string }> = [];

    for (const page of pages) {
        const response = await fetch(page.csvUrl);
        if (!response.ok) throw new Error(`${page.category}: HTTP ${response.status} fetching CSV`);
        const csv = await response.text();
        const rows = parseCsv(csv);
        if (!rows.length) throw new Error(`${page.category}: empty CSV`);
        const [header, ...dataRows] = rows;
        const read = makeReader(header);

        for (const row of dataRows) {
            const name = (row[0] ?? "").trim();
            if (!name) continue;
            const aliasId = normalizedAliases.get(normalizeName(name));
            const candidates = exactByName.get(normalizeName(name)) ?? [];
            const systemId = aliasId ?? (candidates.length === 1 ? candidates[0].systemId : null);
            if (!systemId) {
                issues.push({ category: page.category, name, reason: candidates.length ? `совпадений: ${candidates.length}` : "не найдено в каталоге" });
                continue;
            }
            // Verify the .png exists; otherwise record the issue and skip — we never insert phantom previews.
            const preview = join(previewRoot, `${systemId}.png`);
            try {
                await readFile(preview);
            } catch {
                issues.push({ category: page.category, name, reason: `нет превью ${systemId}.png` });
                continue;
            }

            const stroyRaw = optional(read(row, /^строй$/i));
            records.push({
                name,
                category: page.category,
                brend: extractBrand(name),
                type: optional(read(row, /^тип$/i)) ?? "—",
                power: optional(read(row, /^мощность$/i)),
                test_down: optional(read(row, /тест.*нижн/i)),
                test_up: optional(read(row, /тест.*верх/i)),
                length: optional(read(row, /^длина$/i)),
                sensi: optional(read(row, /чувствител/i)),
                rig: optional(read(row, /^ж.стк/i)),
                stroy: stroyRaw,
                bonus_opit: optional(read(row, /бонус.*опыт/i)),
                bonus_snast: optional(read(row, /бонус.*оснаст/i)),
                bonus_nav: optional(read(row, /бонус.*навыку/i)),
                bonus_zabros: optional(read(row, /бонус.*заброс/i)),
                stren: optional(read(row, /прочност/i)),
                lvl: integer(read(row, /уровень/i)),
                price_ser: optional(read(row, /цена/i)),
                price_gold: null,
                system_id: systemId,
                photo: `/uploads/rods/${systemId}.png`,
                source_url: page.sourceUrl,
            });
            const catalogItem = catalogItems.find((item) => item.systemId === systemId);
            resolutions.push({
                sourceName: name,
                catalogName: catalogItem?.name ?? "",
                systemId,
                method: aliasId ? "alias" : "exact",
            });
        }
    }

    // --- Artefacts (always written, even on dry-run) ---------------------
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(join(artifactRoot, "mapping.json"), JSON.stringify(resolutions, null, 2), "utf8");
    await writeFile(join(artifactRoot, "issues.json"), JSON.stringify(issues, null, 2), "utf8");
    const headers = Object.keys(records[0] ?? {});
    await writeFile(
        join(artifactRoot, "rods.csv"),
        [headers.join(","), ...records.map((row) => headers.map((key) => csvCell(row[key as keyof RodRow])).join(","))].join("\n"),
        "utf8",
    );

    // Potryasov occasionally lists the same rod twice (e.g. typo in length) — keep the first occurrence
    // and log the rest as issues so we still have a clean unique-by-system_id import.
    const dedup = new Map<string, RodRow>();
    for (const row of records) {
        if (dedup.has(row.system_id)) {
            issues.push({ category: row.category, name: row.name, reason: `дубль в источнике (system_id ${row.system_id})` });
            continue;
        }
        dedup.set(row.system_id, row);
    }
    records.length = 0;
    records.push(...dedup.values());

    if (!process.argv.includes("--apply")) {
        console.log(JSON.stringify(
            {
                total: records.length,
                issues: issues.length,
                aliases: resolutions.filter((r) => r.method === "alias").length,
                artifactRoot,
            },
            null,
            2,
        ));
        return;
    }

    // --- Apply: copy previews + upsert by system_id ----------------------
    await mkdir(rodMediaRoot, { recursive: true });
    for (const row of records) {
        await copyFile(join(previewRoot, `${row.system_id}.png`), join(rodMediaRoot, `${row.system_id}.png`));
    }

    const columns = Object.keys(records[0]);
    const updates = columns.filter((c) => c !== "system_id").map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
    const placeholders = (rowIndex: number) => columns.map((_, ci) => `$${rowIndex * columns.length + ci + 1}`).join(", ");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (let i = 0; i < records.length; i += 1) {
            const values = columns.map((c) => records[i][c as keyof RodRow]);
            await client.query(
                `INSERT INTO rods (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders(0)})
                 ON CONFLICT (system_id) WHERE system_id IS NOT NULL DO UPDATE SET ${updates}`,
                values,
            );
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
    } finally {
        client.release();
    }

    console.log(JSON.stringify({ inserted_or_updated: records.length, issues: issues.length, artifactRoot }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
