import "dotenv/config";
import { deleteUploadedMedia, storeUserMedia } from "../src/lib/uploads";

if ((process.env.MEDIA_STORAGE ?? "local").trim().toLowerCase() !== "s3") {
    throw new Error("Set MEDIA_STORAGE=s3 before running the S3 storage test");
}

// A valid 1x1 transparent PNG. The test uploads it, checks public reading, then removes it.
const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
);

let url: string | undefined;

try {
    url = await storeUserMedia({
        folder: "posts",
        body: image,
        extension: "png",
        contentType: "image/png",
    });
    console.log(`S3 upload succeeded: ${url}`);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`The object was uploaded but is not publicly readable: HTTP ${response.status}`);
    }
    console.log(`Public read succeeded: HTTP ${response.status}`);
} finally {
    if (url) {
        await deleteUploadedMedia(url);
        console.log("Test object deleted");
    }
}
