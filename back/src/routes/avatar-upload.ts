import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { requireAuth, requireRole } from "../lib/admin-auth";
import { itemMediaRoot, postMediaRoot, uploadsRoot } from "../lib/uploads";
import { writeAuditLog } from "../lib/audit-log";
import type { SessionUser } from "../lib/admin-auth";

const router = Router();

const maxAvatarBytes = 2 * 1024 * 1024;
const maxItemImageBytes = 10 * 1024 * 1024;
const maxItemModelBytes = 30 * 1024 * 1024;
const maxPostImageBytes = 5 * 1024 * 1024;
const avatarUploadsRoot = join(uploadsRoot, "avatars");

const imageTypes = new Map([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
]);

function isValidImageSignature(buffer: Buffer, contentType: string) {
    if (contentType === "image/png") {
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    if (contentType === "image/jpeg") {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (contentType === "image/webp") {
        return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    }

    if (contentType === "image/gif") {
        const signature = buffer.subarray(0, 6).toString("ascii");
        return signature === "GIF87a" || signature === "GIF89a";
    }

    return false;
}

router.post(
    "/avatar",
    express.raw({
        limit: maxAvatarBytes,
        type: Array.from(imageTypes.keys()),
    }),
    async (req, res, next) => {
        try {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(req.headers),
            });

            if (!session?.user) {
                res.status(401).json({ message: "Authentication required" });
                return;
            }

            const contentType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? "";
            const extension = imageTypes.get(contentType);
            const body = req.body;

            if (!extension || !Buffer.isBuffer(body) || body.length === 0) {
                res.status(400).json({ message: "Upload a PNG, JPEG, WEBP or GIF image" });
                return;
            }

            if (!isValidImageSignature(body, contentType)) {
                res.status(400).json({ message: "File content does not match the image type" });
                return;
            }

            await mkdir(avatarUploadsRoot, { recursive: true });

            const fileName = `${randomUUID()}.${extension}`;
            await writeFile(join(avatarUploadsRoot, fileName), body, { flag: "wx" });

            const publicBaseUrl = process.env.PUBLIC_API_URL ?? process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
            const url = `${publicBaseUrl.replace(/\/$/, "")}/uploads/avatars/${fileName}`;
            await writeAuditLog({
                actor: session.user as SessionUser,
                action: "upload.avatar",
                targetUserId: session.user.id,
                metadata: { contentType, bytes: body.length, url },
            });
            res.json({
                url,
            });
        } catch (error) {
            next(error);
        }
    },
);

function isValidGlb(buffer: Buffer) {
    return buffer.subarray(0, 4).toString("ascii") === "glTF";
}

router.post(
    "/item-media",
    express.raw({ limit: maxItemModelBytes, type: () => true }),
    async (req, res, next) => {
        try {
            const session = await requireRole(req, res, ["admin"]);
            if (!session) return;

            const kind = String(req.query.kind ?? "");
            const body = req.body;

            if (!Buffer.isBuffer(body) || body.length === 0) {
                res.status(400).json({ message: "Файл пустой" });
                return;
            }

            let fileName: string;

            if (kind === "image") {
                const contentType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? "";
                const extension = imageTypes.get(contentType);

                if (!extension) {
                    res.status(400).json({ message: "Загрузите PNG, JPEG, WEBP или GIF" });
                    return;
                }
                if (body.length > maxItemImageBytes) {
                    res.status(400).json({ message: "Изображение больше 10 МБ" });
                    return;
                }
                if (!isValidImageSignature(body, contentType)) {
                    res.status(400).json({ message: "Содержимое не соответствует типу изображения" });
                    return;
                }

                fileName = `${randomUUID()}.${extension}`;
            } else if (kind === "model") {
                if (!isValidGlb(body)) {
                    res.status(400).json({ message: "Ожидается файл .glb (glTF binary)" });
                    return;
                }

                fileName = `${randomUUID()}.glb`;
            } else {
                res.status(400).json({ message: "Укажите kind=image или kind=model" });
                return;
            }

            await mkdir(itemMediaRoot, { recursive: true });
            await writeFile(join(itemMediaRoot, fileName), body, { flag: "wx" });

            const publicBaseUrl = process.env.PUBLIC_API_URL ?? process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
            const url = `${publicBaseUrl.replace(/\/$/, "")}/uploads/items/${fileName}`;
            await writeAuditLog({
                actor: session.user as SessionUser,
                action: kind === "model" ? "upload.item-model" : "upload.item-image",
                metadata: { kind, contentType: req.headers["content-type"] ?? null, bytes: body.length, url },
            });
            res.json({
                url,
            });
        } catch (error) {
            next(error);
        }
    },
);

router.post(
    "/post-media",
    express.raw({ limit: maxPostImageBytes, type: Array.from(imageTypes.keys()) }),
    async (req, res, next) => {
        try {
            const session = await requireAuth(req, res);
            if (!session) return;

            const contentType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? "";
            const extension = imageTypes.get(contentType);
            const body = req.body;

            if (!extension || !Buffer.isBuffer(body) || body.length === 0) {
                res.status(400).json({ message: "Загрузите PNG, JPEG, WEBP или GIF (до 5 МБ)" });
                return;
            }
            if (!isValidImageSignature(body, contentType)) {
                res.status(400).json({ message: "Содержимое не соответствует типу изображения" });
                return;
            }

            await mkdir(postMediaRoot, { recursive: true });
            const fileName = `${randomUUID()}.${extension}`;
            await writeFile(join(postMediaRoot, fileName), body, { flag: "wx" });

            const publicBaseUrl = process.env.PUBLIC_API_URL ?? process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
            const url = `${publicBaseUrl.replace(/\/$/, "")}/uploads/posts/${fileName}`;
            await writeAuditLog({
                actor: session.user as SessionUser,
                action: "upload.post-image",
                targetUserId: session.user.id,
                metadata: { contentType, bytes: body.length, url },
            });
            res.json({
                url,
            });
        } catch (error) {
            next(error);
        }
    },
);

export const avatarUploadRouter = router;
