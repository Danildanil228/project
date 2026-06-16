import { unlink } from "node:fs/promises";
import { join } from "node:path";

export const uploadsRoot = join(process.cwd(), "uploads");
export const itemMediaRoot = join(uploadsRoot, "items");

// Removes a managed upload (only files under /uploads/items/); ignores legacy/public/external values.
export async function deleteUploadedMedia(value: unknown) {
    if (typeof value !== "string") return;
    const marker = "/uploads/items/";
    const index = value.indexOf(marker);
    if (index === -1) return;

    const fileName = value.slice(index + marker.length);
    if (!fileName || fileName.includes("/") || fileName.includes("..")) return;

    await unlink(join(itemMediaRoot, fileName)).catch(() => undefined);
}
