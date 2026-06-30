import assert from "node:assert/strict";
import test from "node:test";
import { extractManagedLocalPath, extractManagedS3Key } from "./uploads";

test("extracts only application-owned S3 media keys", () => {
    const publicBaseUrl = "https://example.selstorage.ru";

    assert.equal(
        extractManagedS3Key(
            "https://example.selstorage.ru/user-content/posts/5b2981f3-2633-4380-b777-074412c8d3a1.webp",
            publicBaseUrl,
        ),
        "user-content/posts/5b2981f3-2633-4380-b777-074412c8d3a1.webp",
    );
    assert.equal(
        extractManagedS3Key(
            "https://example.selstorage.ru/user-content/avatars/5b2981f3-2633-4380-b777-074412c8d3a1.jpg",
            publicBaseUrl,
        ),
        "user-content/avatars/5b2981f3-2633-4380-b777-074412c8d3a1.jpg",
    );
});

test("rejects external and unmanaged S3 URLs", () => {
    const publicBaseUrl = "https://example.selstorage.ru";

    assert.equal(extractManagedS3Key("https://cdn.discordapp.com/avatar.png", publicBaseUrl), null);
    assert.equal(extractManagedS3Key("https://example.selstorage.ru/catalog/fish.png", publicBaseUrl), null);
    assert.equal(extractManagedS3Key("https://example.selstorage.ru/user-content/posts/nested/file.png", publicBaseUrl), null);
    assert.equal(extractManagedS3Key("https://example.selstorage.ru.evil.test/user-content/posts/file.png", publicBaseUrl), null);
});

test("extracts local media paths without accepting lookalike external URLs", () => {
    const ownOrigin = "https://materialhouse.ru";

    assert.equal(extractManagedLocalPath("/uploads/posts/file.webp"), "posts/file.webp");
    assert.equal(
        extractManagedLocalPath("https://materialhouse.ru/uploads/avatars/file.jpg", [ownOrigin]),
        "avatars/file.jpg",
    );
    assert.equal(extractManagedLocalPath("https://evil.test/uploads/posts/file.webp", [ownOrigin]), null);
    assert.equal(extractManagedLocalPath("/uploads/posts/nested/file.webp"), null);
    assert.equal(extractManagedLocalPath("/uploads/../posts/file.webp"), null);
});
