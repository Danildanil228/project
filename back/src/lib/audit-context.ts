import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "./admin-auth";

export type AuditRequestContext = {
    requestId: string;
    ipAddress: string | null;
    userAgent: string | null;
    method: string;
    path: string;
    actor?: SessionUser | null;
    hasFailureEvent?: boolean;
};

const storage = new AsyncLocalStorage<AuditRequestContext>();

export function runWithAuditContext(context: AuditRequestContext, next: () => void) {
    storage.run(context, next);
}

export function getAuditContext() {
    return storage.getStore();
}

export function setAuditActor(actor: SessionUser | null | undefined) {
    const context = storage.getStore();
    if (context) context.actor = actor ?? null;
}
