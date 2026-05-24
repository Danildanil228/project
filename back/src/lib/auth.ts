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

export const auth = betterAuth({
    database: pool,
    emailAndPassword: {
        enabled: true,
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
    trustedOrigins: ["http://localhost:5173"],
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
