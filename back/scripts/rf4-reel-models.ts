// Imports .glb 3D models for reels by matching filename (system_id) to existing rows in the database.
// Source folder layout: C:\Users\danil\Desktop\rf4objects\КатушкиОбъекты\<subfolder>\<system_id>.glb
// Idempotent — re-running overwrites the existing copy but produces no duplicates.

import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db";
import { reelMediaRoot } from "../src/lib/uploads";

const sourceRoot = process.env.RF4_REEL_MODELS_ROOT
    ?? "C:/Users/danil/Desktop/rf4objects/КатушкиОбъекты";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const artifactRoot = join(scriptDir, "..", "..", "artifacts", "rf4-reel-models");

type Report = {
    totalReels: number;
    glbFound: number;
    glbAssigned: number;
    reelsAlreadyHad: number;
    reelsWithoutSystemId: string[];
    glbWithoutMatch: string[];
    matched: { system_id: string; name: string; source: string }[];
};

async function walk(dir: string, acc: string[]) {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        const st = await stat(full).catch(() => null);
        if (!st) continue;
        if (st.isDirectory()) {
            await walk(full, acc);
        } else if (st.isFile() && entry.toLowerCase().endsWith(".glb")) {
            acc.push(full);
        }
    }
}

async function main() {
    const report: Report = {
        totalReels: 0,
        glbFound: 0,
        glbAssigned: 0,
        reelsAlreadyHad: 0,
        reelsWithoutSystemId: [],
        glbWithoutMatch: [],
        matched: [],
    };

    // 1. Collect every .glb in the source folder, indexed by basename without extension.
    const files: string[] = [];
    await walk(sourceRoot, files);
    const bySystemId = new Map<string, string>();
    for (const file of files) {
        const id = basename(file).replace(/\.glb$/i, "");
        // First win — if duplicates exist across subfolders we keep the shallower one (which is what `walk` returns first).
        if (!bySystemId.has(id)) bySystemId.set(id, file);
    }
    report.glbFound = bySystemId.size;
    if (!report.glbFound) {
        throw new Error(`No .glb files found in ${sourceRoot}`);
    }

    // 2. Pull every reel from the database — we need both system_id and current model state.
    const { rows: reels } = await pool.query<{ id: number; name: string; system_id: string | null; model: string | null }>(
        `SELECT id, name, system_id, model FROM reels ORDER BY id`,
    );
    report.totalReels = reels.length;

    await mkdir(reelMediaRoot, { recursive: true });

    // 3. Walk the reels and copy + update.
    for (const reel of reels) {
        if (!reel.system_id) {
            report.reelsWithoutSystemId.push(reel.name);
            continue;
        }
        const source = bySystemId.get(reel.system_id);
        if (!source) continue;

        const targetName = `${reel.system_id}.glb`;
        const target = join(reelMediaRoot, targetName);
        await copyFile(source, target);

        const modelUrl = `/uploads/reels/${targetName}`;
        if (reel.model === modelUrl) {
            report.reelsAlreadyHad += 1;
        }
        await pool.query(`UPDATE reels SET model = $1 WHERE id = $2`, [modelUrl, reel.id]);
        report.glbAssigned += 1;
        report.matched.push({ system_id: reel.system_id, name: reel.name, source });
        bySystemId.delete(reel.system_id);
    }

    // 4. Leftover .glb files = no reel in DB for that system_id; record for the manual review file.
    for (const [id, source] of bySystemId) {
        report.glbWithoutMatch.push(`${id}\t${source}`);
    }

    // 5. Write artefacts.
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(join(artifactRoot, "report.json"), JSON.stringify(report, null, 2), "utf8");
    await writeFile(
        join(artifactRoot, "matched.csv"),
        "system_id,name,source\n" +
            report.matched.map((m) => `${m.system_id},${m.name.replaceAll('"', '""')},${m.source}`).join("\n"),
        "utf8",
    );
    await writeFile(
        join(artifactRoot, "glb-without-match.txt"),
        report.glbWithoutMatch.join("\n"),
        "utf8",
    );
    await writeFile(
        join(artifactRoot, "reels-without-system-id.txt"),
        report.reelsWithoutSystemId.join("\n"),
        "utf8",
    );

    console.log(JSON.stringify(
        {
            totalReels: report.totalReels,
            glbFound: report.glbFound,
            glbAssigned: report.glbAssigned,
            reelsAlreadyHad: report.reelsAlreadyHad,
            reelsWithoutSystemId: report.reelsWithoutSystemId.length,
            glbWithoutMatch: report.glbWithoutMatch.length,
        },
        null,
        2,
    ));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
