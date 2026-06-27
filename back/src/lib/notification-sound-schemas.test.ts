import assert from "node:assert/strict";
import test from "node:test";
import { notificationSoundSettingsSchema } from "./engagement-schemas";

test("notification sound settings accept built-in and custom sounds", () => {
    assert.deepEqual(notificationSoundSettingsSchema.parse({ enabled: true, sound: "default", volume: 0.65 }), {
        enabled: true,
        sound: "default",
        volume: 0.65,
    });
    assert.equal(notificationSoundSettingsSchema.parse({ enabled: false, sound: "custom", volume: "0.4" }).volume, 0.4);
});

test("notification sound settings reject unknown sounds and invalid volume", () => {
    assert.equal(notificationSoundSettingsSchema.safeParse({ enabled: true, sound: "alarm", volume: 0.5 }).success, false);
    assert.equal(notificationSoundSettingsSchema.safeParse({ enabled: true, sound: "soft", volume: 1.1 }).success, false);
});
