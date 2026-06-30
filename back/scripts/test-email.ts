import { sendTestEmail, verifyEmailTransport } from "../src/lib/email";

const recipient = process.argv[2]?.trim();
if (!recipient || !recipient.includes("@")) {
    console.error("Usage: npm run email:test -- user@example.com");
    process.exit(1);
}

await verifyEmailTransport();
console.info("SMTP connection verified");
await sendTestEmail(recipient);
console.info(`Test email sent to ${recipient}`);
