import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUserListQuery, usersToCsv } from "./admin-users-service";

describe("admin user service helpers", () => {
    it("builds a safe filtered user list query", () => {
        const query = buildUserListQuery({
            limit: 25,
            offset: 10,
            searchValue: "test@example.com",
            searchField: "email",
            role: "moderator",
            status: "active",
            emailVerified: "true",
            sortBy: "email",
            sortDirection: "asc",
        });

        assert.equal(query.limit, 25);
        assert.equal(query.offset, 10);
        assert.equal(query.sortSql, "email ASC, id ASC");
        assert.deepEqual(query.values, ["%test@example.com%", "moderator", true]);
        assert.match(query.whereSql, /email ILIKE \$1/);
        assert.match(query.whereSql, /role = \$2/);
        assert.match(query.whereSql, /"emailVerified" = \$3/);
    });

    it("caps export limits and escapes CSV values", () => {
        const query = buildUserListQuery(
            {
                limit: 100,
                offset: 0,
                searchValue: "",
                searchField: "email",
                role: "",
                status: "",
                sortBy: "createdAt",
                sortDirection: "desc",
            },
            9000,
        );

        assert.equal(query.limit, 5000);
        assert.equal(usersToCsv([{ id: 'id-"1"', email: "a@example.com" }]).includes('"id-""1"""'), true);
    });
});
