import type { Request, RequestHandler } from "express";

type LimitRule = {
    path: string;
    methods?: string[];
    max: number;
    windowMs: number;
};

type HitBucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, HitBucket>();

const authRules: LimitRule[] = [
    { path: "/api/auth/sign-in/email", methods: ["POST"], max: 8, windowMs: 15 * 60 * 1000 },
    { path: "/api/auth/sign-up/email", methods: ["POST"], max: 5, windowMs: 60 * 60 * 1000 },
    { path: "/api/auth/request-password-reset", methods: ["POST"], max: 5, windowMs: 15 * 60 * 1000 },
    { path: "/api/auth/send-verification-email", methods: ["POST"], max: 5, windowMs: 15 * 60 * 1000 },
    { path: "/api/auth/reset-password", methods: ["POST"], max: 5, windowMs: 15 * 60 * 1000 },
];

const adminRules: LimitRule[] = [
    { path: "/api/admin/users/export.csv", methods: ["GET"], max: 10, windowMs: 60 * 1000 },
];

function getClientKey(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
    return forwardedIp?.trim() || req.ip || req.socket.remoteAddress || "unknown";
}

function findRule(req: Request) {
    const rules = [...authRules, ...adminRules];

    return rules.find((rule) => {
        if (rule.path !== req.path) return false;
        return !rule.methods || rule.methods.includes(req.method);
    });
}

function cleanup(now: number) {
    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
}

export const sensitiveRateLimit: RequestHandler = (req, res, next) => {
    const rule = findRule(req);
    if (!rule) {
        next();
        return;
    }

    const now = Date.now();
    cleanup(now);

    const clientKey = getClientKey(req);
    const bucketKey = `${rule.path}:${req.method}:${clientKey}`;
    const bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
        buckets.set(bucketKey, {
            count: 1,
            resetAt: now + rule.windowMs,
        });
        next();
        return;
    }

    bucket.count += 1;

    res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("X-RateLimit-Limit", rule.max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, rule.max - bucket.count));
    res.setHeader("X-RateLimit-Reset", new Date(bucket.resetAt).toISOString());

    if (bucket.count > rule.max) {
        res.status(429).json({
            message: "Too many requests. Please try again later.",
        });
        return;
    }

    next();
};
