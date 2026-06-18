import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import dotenv from "dotenv";
import { adminAuditPlugin, logAuthEmail, writeAuditLog } from "./audit-log";
import { adminAccessControlRoles, adminHierarchyGuard, elevatedRoles } from "./admin-roles";
import { pool } from "./db";

dotenv.config();

const superAdminUserIds = process.env.BETTER_AUTH_ADMIN_USER_IDS
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

// Only enable providers whose creds are actually configured — otherwise better-auth would crash on startup.
type ProviderCreds = { clientId: string; clientSecret: string };
function readProvider(idKey: string, secretKey: string): ProviderCreds | undefined {
    const clientId = process.env[idKey]?.trim();
    const clientSecret = process.env[secretKey]?.trim();
    if (!clientId || !clientSecret) return undefined;
    return { clientId, clientSecret };
}

const discord = readProvider("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET");
const vk = readProvider("VK_CLIENT_ID", "VK_CLIENT_SECRET");

export const enabledSocialProviders = {
    discord: Boolean(discord),
    vk: Boolean(vk),
};

export const auth = betterAuth({
    database: pool,
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        revokeSessionsOnPasswordReset: true,
        resetPasswordTokenExpiresIn: 60 * 60,
        sendResetPassword: async ({ user, url }) => {
            await logAuthEmail("password-reset", user.email, url);
        },
        onPasswordReset: async ({ user }) => {
            await writeAuditLog({
                action: "user.password.reset",
                targetUserId: user.id,
                targetEmail: user.email,
            });
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
            await logAuthEmail("verification", user.email, url);
        },
        afterEmailVerification: async (user) => {
            await writeAuditLog({
                action: "user.email.verified",
                targetUserId: user.id,
                targetEmail: user.email,
            });
        },
    },
    baseURL: process.env.BETTER_AUTH_URL!,
    trustedOrigins: (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    socialProviders: {
        ...(discord ? { discord } : {}),
        ...(vk ? { vk } : {}),
    },
    plugins: [
        adminAuditPlugin(),
        adminHierarchyGuard(superAdminUserIds),
        admin({
            adminUserIds: superAdminUserIds,
            defaultRole: "user",
            adminRoles: elevatedRoles,
            roles: adminAccessControlRoles,
        }),
    ],
});
