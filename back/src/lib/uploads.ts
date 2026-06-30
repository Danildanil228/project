import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const uploadsRoot = join(process.cwd(), "uploads");
export const itemMediaRoot = join(uploadsRoot, "items");
export const catalogMediaRoot = join(uploadsRoot, "catalog");
export const fishMediaRoot = join(uploadsRoot, "fish");
export const reelMediaRoot = join(uploadsRoot, "reels");
export const rodMediaRoot = join(uploadsRoot, "rods");
export const notificationSoundRoot = join(uploadsRoot, "notification-sounds");

type UserMediaFolder = "avatars" | "posts";

type S3StorageConfig = {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBaseUrl: string;
    keyPrefix: string;
    forcePathStyle: boolean;
};

let s3Client: S3Client | undefined;

function isS3Enabled() {
    const storage = (process.env.MEDIA_STORAGE ?? "local").trim().toLowerCase();
    if (storage !== "local" && storage !== "s3") {
        throw new Error("MEDIA_STORAGE must be either local or s3");
    }
    return storage === "s3";
}

function requiredEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required when MEDIA_STORAGE=s3`);
    return value;
}

function normalizePrefix(value: string | undefined) {
    return (value ?? "user-content").trim().replace(/^\/+|\/+$/g, "");
}

function getS3Config(): S3StorageConfig {
    return {
        endpoint: requiredEnv("S3_ENDPOINT").replace(/\/$/, ""),
        region: requiredEnv("S3_REGION"),
        bucket: requiredEnv("S3_BUCKET"),
        accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
        publicBaseUrl: requiredEnv("S3_PUBLIC_BASE_URL").replace(/\/$/, ""),
        keyPrefix: normalizePrefix(process.env.S3_KEY_PREFIX),
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true").trim().toLowerCase() !== "false",
    };
}

function getS3Client(config: S3StorageConfig) {
    s3Client ??= new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
    return s3Client;
}

function publicApiUrl() {
    return (process.env.PUBLIC_API_URL ?? process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, "");
}

function objectKey(prefix: string, folder: UserMediaFolder, fileName: string) {
    return [prefix, folder, fileName].filter(Boolean).join("/");
}

function objectUrl(publicBaseUrl: string, key: string) {
    return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function extractManagedS3Key(value: unknown, publicBaseUrl: string, keyPrefix = "user-content") {
    if (typeof value !== "string") return null;

    try {
        const base = new URL(`${publicBaseUrl.replace(/\/$/, "")}/`);
        const target = new URL(value);
        if (base.origin !== target.origin || !target.pathname.startsWith(base.pathname)) return null;

        const key = decodeURIComponent(target.pathname.slice(base.pathname.length));
        const prefix = normalizePrefix(keyPrefix);
        const expectedStart = prefix ? `${prefix}/` : "";
        if (!key.startsWith(expectedStart)) return null;

        const relative = key.slice(expectedStart.length);
        return /^(avatars|posts)\/[A-Za-z0-9._-]+$/.test(relative) ? key : null;
    } catch {
        return null;
    }
}

export function extractManagedLocalPath(value: unknown, allowedBaseUrls: string[] = []) {
    if (typeof value !== "string") return null;

    try {
        let pathname: string;
        if (value.startsWith("/")) {
            pathname = new URL(value, "http://local").pathname;
        } else {
            const target = new URL(value);
            const allowedOrigins = new Set(allowedBaseUrls.flatMap((baseUrl) => {
                try {
                    return [new URL(baseUrl).origin];
                } catch {
                    return [];
                }
            }));
            if (!allowedOrigins.has(target.origin)) return null;
            pathname = target.pathname;
        }

        const marker = "/uploads/";
        if (!pathname.startsWith(marker)) return null;
        const relative = decodeURIComponent(pathname.slice(marker.length));
        return /^(avatars|items|posts|catalog|fish|reels|rods|notification-sounds)\/[A-Za-z0-9._-]+$/.test(relative)
            ? relative
            : null;
    } catch {
        return null;
    }
}

export async function storeUserMedia(options: {
    folder: UserMediaFolder;
    body: Buffer;
    extension: string;
    contentType: string;
}) {
    const fileName = `${randomUUID()}.${options.extension}`;

    if (!isS3Enabled()) {
        const directory = join(uploadsRoot, options.folder);
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, fileName), options.body, { flag: "wx" });
        const path = `/uploads/${options.folder}/${fileName}`;
        return options.folder === "posts" ? path : `${publicApiUrl()}${path}`;
    }

    const config = getS3Config();
    const key = objectKey(config.keyPrefix, options.folder, fileName);
    await getS3Client(config).send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: options.body,
        ContentLength: options.body.length,
        ContentType: options.contentType,
        ContentDisposition: "inline",
        CacheControl: "public, max-age=31536000, immutable",
    }));

    return objectUrl(config.publicBaseUrl, key);
}

// Removes only files managed by this application. External OAuth images are ignored.
export async function deleteUploadedMedia(value: unknown) {
    if (typeof value !== "string") return;

    if (isS3Enabled()) {
        const config = getS3Config();
        const key = extractManagedS3Key(value, config.publicBaseUrl, config.keyPrefix);
        if (key) {
            await getS3Client(config).send(new DeleteObjectCommand({
                Bucket: config.bucket,
                Key: key,
            })).catch((error: unknown) => {
                console.error("Failed to delete an S3 media object", { key, error });
            });
            return;
        }
    }

    const relative = extractManagedLocalPath(value, [
        process.env.PUBLIC_API_URL ?? "",
        process.env.BETTER_AUTH_URL ?? "",
    ]);
    if (!relative) return;

    await unlink(join(uploadsRoot, relative)).catch(() => undefined);
}
