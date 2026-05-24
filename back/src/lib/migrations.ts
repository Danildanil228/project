import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "./db";

dotenv.config();

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(currentDir, "..", "..", "migrations");

export async function runMigrations() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "appMigration" (
            id TEXT PRIMARY KEY,
            "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const files = (await readdir(migrationsDir))
        .filter((file) => file.endsWith(".sql"))
        .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
        const alreadyApplied = await pool.query(`SELECT id FROM "appMigration" WHERE id = $1`, [file]);
        if (alreadyApplied.rowCount) continue;

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const sql = await readFile(join(migrationsDir, file), "utf8");
            await client.query(sql);
            await client.query(`INSERT INTO "appMigration" (id) VALUES ($1)`, [file]);
            await client.query("COMMIT");
            console.log(`Applied migration ${file}`);
        } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
        } finally {
            client.release();
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runMigrations()
        .then(() => pool.end())
        .catch(async (error) => {
            console.error(error);
            await pool.end();
            process.exit(1);
        });
}
