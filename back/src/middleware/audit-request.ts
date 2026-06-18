import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { runWithAuditContext, type AuditRequestContext } from "../lib/audit-context";
import { writeAuditLog } from "../lib/audit-log";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function headerValue(value: string | string[] | undefined) {
    const text = Array.isArray(value) ? value[0] : value;
    return text?.slice(0, 1000) ?? null;
}

export function auditRequestContext(req: Request, res: Response, next: NextFunction) {
    const context: AuditRequestContext = {
        requestId: randomUUID(),
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: headerValue(req.headers["user-agent"]),
        method: req.method,
        path: req.originalUrl.split("?")[0],
        actor: null,
    };

    res.setHeader("X-Request-Id", context.requestId);
    runWithAuditContext(context, () => {
        res.once("finish", () => {
            if (!mutatingMethods.has(req.method) || res.statusCode < 400 || context.hasFailureEvent) return;

            void writeAuditLog({
                actor: context.actor,
                action: "request.failed",
                outcome: "failure",
                metadata: { statusCode: res.statusCode },
            }).catch((error) => console.warn("Failed to write rejected request audit log", error));
        });
        next();
    });
}
