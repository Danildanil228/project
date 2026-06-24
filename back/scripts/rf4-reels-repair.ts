// One-off repair: the original reels importer used positional indices that didn't match the
// live Google Sheets layout for Силовые (meh ↔ capacity swap) and Байткастинговые
// (whole speed/meh/frik block shifted). This script re-reads each source CSV using header
// names (not positions) and overwrites ONLY the numeric attribute columns. It does not touch
// name, photo, model, system_id or source_url — those were imported correctly.
//
// Dry-run: npx tsx back/scripts/rf4-reels-repair.ts
// Apply:   npx tsx back/scripts/rf4-reels-repair.ts --apply

import { pool } from "../src/lib/db";

const pages = [
    { category: "Безинерционные", csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTASlrevowPn2ktNqhPAwaBBa5g0stLj22ZNYk2H40x9dKJadX69Npk8hjXKB_yquQwmnGvA_mF5vz4/pub?gid=874365786&single=true&output=csv" },
    { category: "Байткастинговые", csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSboVmwd1K8JRBOKxzK-JjuX5zEMvCQlmE1Ad1d11BgA3PTgQI0RP7TqArdPOBnzfIjViY6uclqkX9d/pub?gid=1244985690&single=true&output=csv" },
    { category: "Силовые", csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4AViBguPYtOW8HiaOkBt5_lSURYqourEuCRP13e_QDNbJ0lPYCb4LDXrDGjrpUOeFgmvPHxl9Yx5j/pub?gid=1953747931&single=true&output=csv" },
    { category: "Низкопрофильные", csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqtY2LdPd3hpz9npGuDwy-v35d30B40Nlj1ypReegmkOHG4ja1UmHFxf48qx4yyWB8pzavas1F0Zkt/pub?gid=1845483855&single=true&output=csv" },
] as const;

function parseCsv(text: string): string[][] {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    const rows: string[][] = [];
    for (const line of lines) {
        const cells: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (ch === '"') {
                if (inQ && line[i + 1] === '"') { cur += '"'; i += 1; }
                else inQ = !inQ;
            } else if (ch === "," && !inQ) { cells.push(cur); cur = ""; }
            else cur += ch;
        }
        cells.push(cur);
        rows.push(cells);
    }
    return rows;
}

// header is the full row 1 of the CSV; for duplicated label "Мод" we use position-aware
// matching: each call to `pick(...regex)` returns the first column that hasn't been used yet.
type Reader = (re: RegExp) => string | null;

function makeReader(header: string[], row: string[]): Reader {
    const seen = new Set<number>();
    return (re: RegExp) => {
        for (let i = 0; i < header.length; i += 1) {
            if (seen.has(i)) continue;
            if (re.test(header[i])) {
                seen.add(i);
                const v = (row[i] ?? "").trim();
                return v && v !== "-" && v !== "?" ? v : null;
            }
        }
        return null;
    };
}

// Picks the "Мод" column immediately following a named attribute. Many sheets have repeated
// "Мод" headers — we need the *next* one after the parent attribute.
function makeNeighborReader(header: string[], row: string[]) {
    return (parentRe: RegExp): { value: string | null; mod: string | null } => {
        const idx = header.findIndex((h) => parentRe.test(h));
        if (idx < 0) return { value: null, mod: null };
        const valueRaw = (row[idx] ?? "").trim();
        const value = valueRaw && valueRaw !== "-" && valueRaw !== "?" ? valueRaw : null;
        // Next column is a "Мод" if its header is exactly "Мод" or "Моды".
        const next = idx + 1 < header.length && /^мод/i.test(header[idx + 1]) ? (row[idx + 1] ?? "").trim() : "";
        const mod = next && next !== "-" && next !== "?" ? next : null;
        return { value, mod };
    };
}

type Patch = {
    name: string;
    category: string;
    meh: string | null;
    meh_mod: string | null;
    capacity: string | null;
    speed: string | null;
    speed_mod: string | null;
    frik: string | null;
    frik_mod: string | null;
};

async function main() {
    const apply = process.argv.includes("--apply");
    const patches: Patch[] = [];

    for (const page of pages) {
        const response = await fetch(page.csvUrl);
        if (!response.ok) throw new Error(`${page.category}: HTTP ${response.status}`);
        const csv = await response.text();
        const [header, ...dataRows] = parseCsv(csv);
        console.log(`\n[${page.category}] header: ${header.join(" | ")}`);

        for (const row of dataRows) {
            const name = (row[0] ?? "").trim();
            if (!name) continue;
            const get = makeNeighborReader(header, row);
            const meh = get(/^шестерня/i);
            const speed = get(/^скорость/i);
            const frik = get(/^фрикцион/i);
            const capacity = get(/^[её]мкость/i).value;
            patches.push({
                name,
                category: page.category,
                meh: meh.value,
                meh_mod: meh.mod,
                speed: speed.value,
                speed_mod: speed.mod,
                frik: frik.value,
                frik_mod: frik.mod,
                capacity,
            });
        }
    }

    console.log(`\nParsed ${patches.length} rows from CSVs.`);

    // Diff against current DB (sample a few interesting ones first).
    const sample = ["Taiga C 30", "Albacore 20", "Rocket Jet SG80", "Admiral 1000s"];
    for (const target of sample) {
        const patch = patches.find((p) => p.name === target);
        if (!patch) continue;
        const { rows: [current] } = await pool.query(
            "SELECT name, meh, meh_mod, capacity, speed, speed_mod, frik, frik_mod FROM reels WHERE name = $1 LIMIT 1",
            [target],
        );
        console.log(`\n--- ${target} (${patch.category}) ---`);
        console.log("  source:", JSON.stringify({ meh: patch.meh, meh_mod: patch.meh_mod, capacity: patch.capacity, speed: patch.speed, frik: patch.frik, frik_mod: patch.frik_mod }));
        console.log("  in DB :", JSON.stringify(current ?? "not found"));
    }

    if (!apply) {
        console.log("\nDry-run only. Pass --apply to write patches.");
        await pool.end();
        return;
    }

    let updated = 0, missing = 0;
    for (const patch of patches) {
        // Build dynamic UPDATE: skip columns whose source value is null. This protects against
        // NOT NULL columns (speed, frik, meh in schema 003) — if the sheet has "-" or "?" we
        // leave whatever was previously imported alone instead of forcing NULL and crashing.
        const sets: string[] = [];
        const values: unknown[] = [];
        const push = (col: string, value: string | null) => {
            if (value === null) return;
            values.push(value);
            sets.push(`${col} = $${values.length}`);
        };
        push("meh", patch.meh);
        push("meh_mod", patch.meh_mod);
        push("capacity", patch.capacity);
        push("speed", patch.speed);
        push("speed_mod", patch.speed_mod);
        push("frik", patch.frik);
        push("frik_mod", patch.frik_mod);
        if (sets.length === 0) { missing += 1; continue; }
        values.push(patch.name, patch.category);
        const result = await pool.query(
            `UPDATE reels SET ${sets.join(", ")} WHERE name = $${values.length - 1} AND category = $${values.length}`,
            values,
        );
        if (result.rowCount && result.rowCount > 0) updated += result.rowCount;
        else missing += 1;
    }
    console.log(`\nApplied: ${updated} rows updated, ${missing} not found in DB.`);
    await pool.end();
}

await main();
