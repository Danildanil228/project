import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import express, { Router } from "express";
import { requireAuth, type SessionUser } from "../lib/admin-auth";
import { parseOrSend } from "../lib/validation";
import { markReadSchema, notificationQuerySchema, notificationSoundSettingsSchema } from "../lib/engagement-schemas";
import { deleteUploadedMedia, notificationSoundRoot } from "../lib/uploads";
import {
    getNotificationSoundSettings,
    listNotifications,
    markRead,
    removeCustomNotificationSound,
    setCustomNotificationSound,
    unreadSummary,
    updateNotificationSoundSettings,
} from "../services/notification-service";
import { subscribeToNotifications } from "../services/notification-realtime";

const router = Router();
const maxSoundBytes = 2 * 1024 * 1024;
const soundTypes = new Map([
    ["audio/mpeg", "mp3"],
    ["audio/mp3", "mp3"],
    ["audio/wav", "wav"],
    ["audio/x-wav", "wav"],
    ["audio/ogg", "ogg"],
    ["audio/webm", "webm"],
    ["audio/mp4", "m4a"],
    ["audio/x-m4a", "m4a"],
]);

function validSoundSignature(buffer: Buffer, extension: string) {
    if (extension === "mp3") {
        return buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    }
    if (extension === "wav") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE";
    if (extension === "ogg") return buffer.subarray(0, 4).toString("ascii") === "OggS";
    if (extension === "webm") return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (extension === "m4a") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    return false;
}

router.get("/", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const query = parseOrSend(notificationQuerySchema, req.query, res);
        if (!query) return;
        res.json(await listNotifications(session.user.id, query));
    } catch (error) {
        next(error);
    }
});

router.get("/unread-count", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        res.json(await unreadSummary(session.user.id));
    } catch (error) {
        next(error);
    }
});

router.get("/stream", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;

        res.status(200);
        res.set({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        res.write("retry: 3000\n");
        res.write("event: ready\ndata: {}\n\n");

        const unsubscribe = subscribeToNotifications(session.user.id, ({ id }) => {
            if (!res.writableEnded) res.write(`id: ${id}\nevent: notification\ndata: {\"id\":${id}}\n\n`);
        });
        const heartbeat = setInterval(() => {
            if (!res.writableEnded) res.write(": heartbeat\n\n");
        }, 20_000);

        req.once("close", () => {
            clearInterval(heartbeat);
            unsubscribe();
            if (!res.writableEnded) res.end();
        });
    } catch (error) {
        next(error);
    }
});

router.get("/sound", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        res.json(await getNotificationSoundSettings(session.user.id));
    } catch (error) {
        next(error);
    }
});

router.patch("/sound", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const input = parseOrSend(notificationSoundSettingsSchema, req.body, res);
        if (!input) return;
        const result = await updateNotificationSoundSettings(session.user as SessionUser, input);
        if (result.status === "missing-custom") {
            res.status(409).json({ message: "Сначала загрузите свой звук" });
            return;
        }
        res.json(result.settings);
    } catch (error) {
        next(error);
    }
});

router.post(
    "/sound/custom",
    express.raw({ limit: maxSoundBytes, type: Array.from(soundTypes.keys()) }),
    async (req, res, next) => {
        let uploadedUrl: string | null = null;
        try {
            const session = await requireAuth(req, res);
            if (!session) return;
            const contentType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? "";
            const extension = soundTypes.get(contentType);
            const body = req.body;
            if (!extension || !Buffer.isBuffer(body) || body.length === 0 || !validSoundSignature(body, extension)) {
                res.status(400).json({ message: "Загрузите MP3, WAV, OGG, WebM или M4A до 2 МБ" });
                return;
            }

            await mkdir(notificationSoundRoot, { recursive: true });
            const fileName = `${randomUUID()}.${extension}`;
            await writeFile(join(notificationSoundRoot, fileName), body, { flag: "wx" });
            const publicBaseUrl = process.env.PUBLIC_API_URL ?? process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
            uploadedUrl = `${publicBaseUrl.replace(/\/$/, "")}/uploads/notification-sounds/${fileName}`;
            res.json(await setCustomNotificationSound(session.user as SessionUser, uploadedUrl));
        } catch (error) {
            if (uploadedUrl) await deleteUploadedMedia(uploadedUrl);
            next(error);
        }
    },
);

router.delete("/sound/custom", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        res.json(await removeCustomNotificationSound(session.user as SessionUser));
    } catch (error) {
        next(error);
    }
});

router.post("/read", async (req, res, next) => {
    try {
        const session = await requireAuth(req, res);
        if (!session) return;
        const body = parseOrSend(markReadSchema, req.body ?? {}, res);
        if (!body) return;
        res.json(await markRead(session.user as SessionUser, body.ids));
    } catch (error) {
        next(error);
    }
});

export const notificationsRouter = router;
