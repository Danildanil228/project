import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthEmail } from "./email";

test("signup email contains the OTP in text and HTML", () => {
    const email = buildAuthEmail("signup-otp", "123456");
    assert.match(email.subject, /Код подтверждения/);
    assert.match(email.text, /123456/);
    assert.match(email.html, /123456/);
});

test("password reset email escapes its link in HTML", () => {
    const email = buildAuthEmail("password-reset", 'https://example.com/reset?a=1&b="2"');
    assert.match(email.html, /a=1&amp;b=&quot;2&quot;/);
    assert.doesNotMatch(email.html, /a=1&b="2"/);
});
