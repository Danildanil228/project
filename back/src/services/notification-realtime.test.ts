import assert from "node:assert/strict";
import test from "node:test";
import { publishNotification, subscribeToNotifications } from "./notification-realtime";

test("notification realtime publishes only to the intended user", () => {
    const firstUserEvents: number[] = [];
    const secondUserEvents: number[] = [];
    const unsubscribeFirst = subscribeToNotifications("user-1", (event) => firstUserEvents.push(event.id));
    const unsubscribeSecond = subscribeToNotifications("user-2", (event) => secondUserEvents.push(event.id));

    publishNotification({ id: 10, userId: "user-1" });

    assert.deepEqual(firstUserEvents, [10]);
    assert.deepEqual(secondUserEvents, []);
    unsubscribeFirst();
    unsubscribeSecond();
});

test("notification realtime stops publishing after unsubscribe", () => {
    const events: number[] = [];
    const unsubscribe = subscribeToNotifications("user-3", (event) => events.push(event.id));
    unsubscribe();

    publishNotification({ id: 11, userId: "user-3" });

    assert.deepEqual(events, []);
});
