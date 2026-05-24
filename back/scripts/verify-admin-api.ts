const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:5173";
const adminEmail = process.env.ADMIN_TEST_EMAIL;
const adminPassword = process.env.ADMIN_TEST_PASSWORD;

type CheckResult = {
    name: string;
    ok: boolean;
    details?: string;
};

const results: CheckResult[] = [];
let cookie = "";

function record(name: string, ok: boolean, details?: string) {
    results.push({ name, ok, details });
}

async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            origin: appOrigin,
            ...(cookie ? { cookie } : {}),
            ...init.headers,
        },
    });

    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length) {
        cookie = setCookie.map((item) => item.split(";")[0]).join("; ");
    }

    return response;
}

async function json(response: Response) {
    return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

async function main() {
    if (!adminEmail || !adminPassword) {
        throw new Error("Set ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD to run this verification.");
    }

    const health = await request("/health");
    record("health endpoint", health.ok, String(health.status));

    const login = await request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
        }),
    });
    record("admin login", login.ok, String(login.status));

    const context = await request("/api/admin/context");
    const contextBody = await json(context);
    record(
        "admin context",
        context.ok && contextBody?.hasElevatedAccess === true,
        JSON.stringify(contextBody),
    );

    const users = await request("/api/admin/users?limit=5&offset=0&sortBy=createdAt&sortDirection=desc");
    const usersBody = await json(users);
    record(
        "managed users list",
        users.ok && Array.isArray(usersBody?.users) && typeof usersBody?.total === "number",
        JSON.stringify({ status: users.status, total: usersBody?.total }),
    );

    const audit = await request("/api/admin/audit-logs?limit=5&offset=0");
    const auditBody = await json(audit);
    record(
        "audit list",
        audit.ok && Array.isArray(auditBody?.logs) && typeof auditBody?.total === "number",
        JSON.stringify({ status: audit.status, total: auditBody?.total }),
    );

    const exportUsers = await request("/api/admin/users/export.csv?sortBy=createdAt&sortDirection=desc");
    record("users csv export", exportUsers.ok && (exportUsers.headers.get("content-type") ?? "").includes("text/csv"));

    const exportAudit = await request("/api/admin/audit-logs/export.csv?limit=10");
    record("audit csv export", exportAudit.ok && (exportAudit.headers.get("content-type") ?? "").includes("text/csv"));

    const tinyPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
    );
    const uploadAvatar = await request("/api/uploads/avatar", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: tinyPng,
    });
    const uploadAvatarBody = await json(uploadAvatar);
    record(
        "avatar upload",
        uploadAvatar.ok && typeof uploadAvatarBody?.url === "string" && String(uploadAvatarBody.url).includes("/uploads/avatars/"),
        JSON.stringify({ status: uploadAvatar.status, url: uploadAvatarBody?.url }),
    );

    const invalidBulk = await request("/api/admin/users/bulk-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [], role: "owner" }),
    });
    record("invalid bulk role validation", invalidBulk.status === 400, String(invalidBulk.status));

    for (const result of results) {
        console.log(`${result.ok ? "OK" : "FAIL"} ${result.name}${result.details ? ` - ${result.details}` : ""}`);
    }

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
