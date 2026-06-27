import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";

export type NotificationRealtimeEvent = {
    id: number;
    userId: string;
};

type NotificationListener = (event: NotificationRealtimeEvent) => void;

const listenersByUser = new Map<string, Set<NotificationListener>>();
const channel = "notification_realtime";
const instanceId = randomUUID();
let listenerClient: PoolClient | null = null;
let connectPromise: Promise<void> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let stopping = false;

export function subscribeToNotifications(userId: string, listener: NotificationListener) {
    const listeners = listenersByUser.get(userId) ?? new Set<NotificationListener>();
    listeners.add(listener);
    listenersByUser.set(userId, listeners);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) listenersByUser.delete(userId);
    };
}

export function publishNotification(event: NotificationRealtimeEvent) {
    for (const listener of listenersByUser.get(event.userId) ?? []) {
        try {
            listener(event);
        } catch (error) {
            console.warn("Failed to publish realtime notification", error);
        }
    }
}

function scheduleReconnect() {
    if (stopping || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void startNotificationRealtime();
    }, 3_000);
    reconnectTimer.unref();
}

async function connectListener() {
    const client = await pool.connect();
    let disconnected = false;

    const disconnect = (error?: Error) => {
        if (disconnected) return;
        disconnected = true;
        if (error) console.warn("Notification realtime listener disconnected", error);
        if (listenerClient === client) listenerClient = null;
        client.removeAllListeners("notification");
        client.removeAllListeners("error");
        client.removeAllListeners("end");
        client.release(true);
        scheduleReconnect();
    };

    client.on("notification", (message) => {
        if (message.channel !== channel || !message.payload) return;
        try {
            const event = JSON.parse(message.payload) as NotificationRealtimeEvent & { origin?: string };
            if (event.origin !== instanceId && Number.isInteger(event.id) && typeof event.userId === "string") {
                publishNotification({ id: event.id, userId: event.userId });
            }
        } catch (error) {
            console.warn("Ignored malformed realtime notification", error);
        }
    });
    client.once("error", disconnect);
    client.once("end", () => disconnect());
    try {
        await client.query(`LISTEN ${channel}`);
    } catch (error) {
        disconnect(error as Error);
        return;
    }
    if (stopping) {
        client.removeAllListeners();
        client.release();
        return;
    }
    listenerClient = client;
}

export async function startNotificationRealtime() {
    if (listenerClient || connectPromise || stopping) return connectPromise ?? Promise.resolve();
    connectPromise = connectListener()
        .catch((error) => {
            console.warn("Failed to start notification realtime listener", error);
            scheduleReconnect();
        })
        .finally(() => {
            connectPromise = null;
        });
    return connectPromise;
}

export async function broadcastNotification(event: NotificationRealtimeEvent) {
    publishNotification(event);
    try {
        await pool.query(`SELECT pg_notify($1, $2)`, [channel, JSON.stringify({ ...event, origin: instanceId })]);
    } catch (error) {
        console.warn("Failed to broadcast notification between API instances", error);
    }
}

export function stopNotificationRealtime() {
    stopping = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (listenerClient) {
        const client = listenerClient;
        listenerClient = null;
        client.removeAllListeners();
        client.release();
    }
}
