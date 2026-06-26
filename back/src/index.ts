import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth, enabledSocialProviders } from './lib/auth';
import dotenv from 'dotenv';
import cors from 'cors';
import { runMigrations } from './lib/migrations';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { sensitiveRateLimit } from './middleware/rate-limit';
import { securityHeaders } from './middleware/security-headers';
import { adminAccountsRouter } from './routes/admin-accounts';
import { avatarUploadRouter } from './routes/avatar-upload';
import { uploadsRoot } from './lib/uploads';
import { createItemsRouter } from './routes/items';
import { fishRouter } from './routes/fish';
import { waterbodiesRouter } from './routes/waterbodies';
import { postsRouter } from './routes/posts';
import { engagementRouter } from './routes/engagement';
import { reportsRouter } from './routes/reports';
import { notificationsRouter } from './routes/notifications';
import { baitsRouter } from './routes/baits';
import { spotsRouter } from './routes/spots';
import { auditRequestContext } from './middleware/audit-request';
import { mapSubmissionsRouter } from './routes/map-submissions';
import { calculatorRouter } from './routes/calculator';
import { accountRouter } from './routes/account';
import { postMapLinkingEnabled } from './lib/features';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const webOrigins = (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.set("trust proxy", 1);
app.use(auditRequestContext);
app.use(securityHeaders);
app.use(
    cors({
        origin: webOrigins,
        credentials: true,
    }),
);
app.use(sensitiveRateLimit);

app.post('/api/auth/admin/set-role', (_req, res) => {
    res.status(410).json({
        message: "Use /api/admin/users/:userId/role for role changes",
    });
});

app.all('/api/auth/*splat', toNodeHandler(auth));
app.use('/uploads', express.static(uploadsRoot, {
    fallthrough: false,
    immutable: true,
    maxAge: "30d",
}));
app.use('/api/uploads', avatarUploadRouter);
app.use(express.json());
app.use('/api/admin', adminAccountsRouter);

await runMigrations();

app.get('/health', (_req, res) => {
    res.json({ status: "ok" });
});

// Tells the frontend which social providers are configured so we only render buttons that actually work.
app.get('/api/auth-providers', (_req, res) => {
    res.json(enabledSocialProviders);
});

app.use('/api/reels', createItemsRouter('reels'));
app.use('/api/rods', createItemsRouter('rods'));
app.use('/api/calculator', calculatorRouter);
app.use('/api/account', accountRouter);
app.use('/api/fish', fishRouter);
app.use('/api/waterbodies', waterbodiesRouter);
app.use('/api/baits', baitsRouter);
app.use('/api/spots', spotsRouter);
if (postMapLinkingEnabled) app.use('/api/map-submissions', mapSubmissionsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/posts', engagementRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);

app.use('/api', notFoundHandler);
app.use(errorHandler);



const server = app.listen(port, host, () => {
    console.log(`API server listening on http://${host}:${port}`);
});

async function shutdown(signal: string) {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
        await pool.end().catch(() => undefined);
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
