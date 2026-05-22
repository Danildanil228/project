import { betterAuth } from "better-auth";
import pg from "pg";
import dotenv from "dotenv";
import { admin } from "better-auth/plugins/admin";
import { createAccessControl } from 'better-auth/plugins/access';

dotenv.config();

const statement = {
    user: ['create','list', 'read', 'update', 'delete', 'ban', 'set-role', 'impersonate'],
    session: ['list', 'revoke', 'delete'],
} as const;

const ac = createAccessControl(statement);

const adminRole = ac.newRole({
    user: ['create', 'list', 'read', 'update', 'delete', 'ban', 'set-role', 'impersonate'],
    session: ['list', 'revoke', 'delete'],
});

const moderatorRole = ac.newRole({
    user: ['read', 'update', 'ban'],
    session: ['list'],
});

const userRole = ac.newRole({
    user: ['read'],
    session: ['list'],
})

const pool = new pg.Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
});

export const auth = betterAuth({
    database: pool,
    emailAndPassword: {
        enabled: true,
    },
    baseURL: process.env.BETTER_AUTH_URL!,
    trustedOrigins: ["http://localhost:5173"],
    plugins: [
        admin({
            ac,
            roles: {
                admin: adminRole,
                moderator: moderatorRole,
                user: userRole,
            },
            defaultRole: 'user',
            adminRoles: ['admin'],
            defaultBanReason: "Нарушение правил платформы",
            defaultBanExpiresIn: undefined,
            bannedUserMessage: "Ваш аккаунт заблокирован. Обратитесь в поддержку.",
        }),
    ],
});
