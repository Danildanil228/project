import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { auditActionFromPath, sanitizeAuditMetadata } from "./audit-log";

describe("audit log helpers", () => {
    test("redacts credentials recursively without removing safe metadata", () => {
        assert.deepEqual(
            sanitizeAuditMetadata({
                email: "user@example.com",
                password: "plain-text",
                profile: {
                    newPassword: "next-password",
                    accessToken: "access-token",
                    displayName: "User",
                },
            }),
            {
                email: "user@example.com",
                password: "[redacted]",
                profile: {
                    newPassword: "[redacted]",
                    accessToken: "[redacted]",
                    displayName: "User",
                },
            },
        );
    });

    test("maps core auth endpoints to stable domain actions", () => {
        assert.equal(auditActionFromPath("/sign-up/email"), "auth.register");
        assert.equal(auditActionFromPath("/sign-in/email"), "auth.login");
        assert.equal(auditActionFromPath("/revoke-other-sessions"), "auth.sessions.revoke-others");
        assert.equal(auditActionFromPath("/callback/discord"), "auth.login.social");
    });
});
