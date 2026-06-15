import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import dotenv from 'dotenv';
import cors from 'cors';
import { runMigrations } from './lib/migrations';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { sensitiveRateLimit } from './middleware/rate-limit';
import { securityHeaders } from './middleware/security-headers';
import { adminAccountsRouter } from './routes/admin-accounts';
import { avatarUploadRouter, uploadsRoot } from './routes/avatar-upload';
import { reelsRouter } from './routes/reels';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(
    cors({
        origin: "http://localhost:5173",
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

app.use('/api/reels', reelsRouter);

app.use('/api', notFoundHandler);
app.use(errorHandler);



app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
});
