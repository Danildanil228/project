import { unlink } from "node:fs/promises";
import { join } from "node:path";

export const uploadsRoot = join(process.cwd(), "uploads");
export const itemMediaRoot = join(uploadsRoot, "items");
export const postMediaRoot = join(uploadsRoot, "posts");
export const catalogMediaRoot = join(uploadsRoot, "catalog");
export const fishMediaRoot = join(uploadsRoot, "fish");
export const reelMediaRoot = join(uploadsRoot, "reels");
export const rodMediaRoot = join(uploadsRoot, "rods");

// Removes a managed upload; ignores legacy/external values and nested paths.
export async function deleteUploadedMedia(value: unknown) {
    if (typeof value !== "string") return;
    const marker = "/uploads/";
    const index = value.indexOf(marker);
    if (index === -1) return;

    const relative = value.slice(index + marker.length);
    if (!/^(avatars|items|posts|catalog|fish|reels|rods)\/[A-Za-z0-9._-]+$/.test(relative)) return;

    await unlink(join(uploadsRoot, relative)).catch(() => undefined);
}
