import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db";

const currentDir = dirname(fileURLToPath(import.meta.url));
const seedsDir = join(currentDir, "..", "..", "seeds");
const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function assertSeedTargetIsSafe() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Refusing to seed while NODE_ENV=production");
    }

    const host = process.env.DB_HOST?.trim().toLowerCase();
    if (!host || !localDatabaseHosts.has(host)) {
        throw new Error("Refusing to seed a non-local database. Use a local DB_HOST.");
    }
}

export async function runSeeds() {
    assertSeedTargetIsSafe();

    await pool.query(`
        CREATE TABLE IF NOT EXISTS "appSeed" (
            id TEXT PRIMARY KEY,
            "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const files = (await readdir(seedsDir))
        .filter((file) => file.endsWith(".sql"))
        .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
        const alreadyApplied = await pool.query(`SELECT id FROM "appSeed" WHERE id = $1`, [file]);
        if (alreadyApplied.rowCount) continue;

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(await readFile(join(seedsDir, file), "utf8"));
            await client.query(`INSERT INTO "appSeed" (id) VALUES ($1)`, [file]);
            await client.query("COMMIT");
            console.log(`Applied seed ${file}`);
        } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
        } finally {
            client.release();
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runSeeds()
        .then(() => pool.end())
        .catch(async (error) => {
            console.error(error);
            await pool.end();
            process.exit(1);
        });
}
