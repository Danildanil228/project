import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canManageRoleRank, hasElevatedAccess, hasRole, highestRoleRank, isSuperAdmin, roleRank } from "./admin-roles";

describe("admin role helpers", () => {
    it("reads a comma separated role list", () => {
        assert.equal(hasRole({ id: "user-1", role: "moderator,user" }, "moderator"), true);
        assert.equal(hasRole({ id: "user-1", role: "moderator,user" }, "admin"), false);
    });

    it("treats super admin ids as elevated access", () => {
        const user = { id: "super-admin", role: "user" };

        assert.equal(isSuperAdmin(user, ["super-admin"]), true);
        assert.equal(hasElevatedAccess(user, ["super-admin"]), true);
    });

    it("treats admins and moderators as elevated roles", () => {
        assert.equal(hasElevatedAccess({ id: "admin-1", role: "admin" }), true);
        assert.equal(hasElevatedAccess({ id: "mod-1", role: "moderator" }), true);
        assert.equal(hasElevatedAccess({ id: "user-1", role: "user" }), false);
    });

    it("orders roles strictly for management decisions", () => {
        assert.equal(roleRank("admin") > roleRank("moderator"), true);
        assert.equal(highestRoleRank({ id: "admin-1", role: "admin" }) > highestRoleRank({ id: "mod-1", role: "moderator" }), true);
        assert.equal(canManageRoleRank({ id: "admin-1", role: "admin" }, "admin"), false);
        assert.equal(canManageRoleRank({ id: "admin-1", role: "admin" }, "moderator"), true);
        assert.equal(canManageRoleRank({ id: "mod-1", role: "moderator" }, "moderator"), false);
        assert.equal(canManageRoleRank({ id: "mod-1", role: "moderator" }, "user"), true);
    });
});
