import { join } from "node:path";

export const uploadsRoot = join(process.cwd(), "uploads");
export const itemMediaRoot = join(uploadsRoot, "items");
