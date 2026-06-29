import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import dotenv from "dotenv";
import { adminAuditPlugin, logAuthEmail, writeAuditLog } from "./audit-log";
import { adminAccessControlRoles, adminHierarchyGuard, elevatedRoles } from "./admin-roles";
import { pool } from "./db";
import { deleteUploadedMedia } from "./uploads";

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
const vkCredentials = readProvider("VK_CLIENT_ID", "VK_CLIENT_SECRET");
const vk = vkCredentials
    ? {
        ...vkCredentials,
        // A successful VK ID OAuth flow proves control of the VK account. Treat the email
        // returned by VK as verified so social sign-up does not require a second OTP check.
        mapProfileToUser: (profile: { user: { email?: string } }) => ({
            emailVerified: Boolean(profile.user.email),
        }),
    }
    : undefined;

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
        // We verify email with our own 6-digit OTP at /api/account/email-verify/* — better-auth's
        // verification-link email would just be noise alongside it. Keep sendOnSignIn off too so
        // re-login attempts on unverified accounts don't spam a second link either.
        sendOnSignUp: false,
        sendOnSignIn: false,
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
    databaseHooks: {
        user: {
            // Wipe the avatar file from disk whenever a user is deleted (admin or self-service).
            // Only files under /uploads/avatars/ are touched — OAuth-provider URLs are ignored by
            // deleteUploadedMedia's prefix check.
            //
            // Note: we don't validate `image` on update.before — OAuth sign-in writes the provider's
            // own CDN URL into this column on every login, and rejecting non-local URLs would break
            // discord/vk auth. URL-input prevention lives in the UI.
            delete: {
                after: async (user: { image?: string | null } | null | undefined) => {
                    if (user?.image) await deleteUploadedMedia(user.image);
                },
            },
        },
    },
});
