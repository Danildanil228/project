import dotenv from "dotenv";
import nodemailer, { type Transporter } from "nodemailer";
import { writeAuditLog } from "./audit-log";

dotenv.config();

export type AuthEmailType = "verification" | "password-reset" | "password-change-code" | "signup-otp";

type EmailContent = {
    subject: string;
    text: string;
    html: string;
};

let smtpTransporter: Transporter | null = null;

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function emailLayout(title: string, body: string) {
    return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f7f8;color:#10222b;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:#f5f7f8">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dce3e7;border-radius:8px">
        <tr><td style="padding:20px 24px;border-bottom:1px solid #dce3e7;font-size:18px;font-weight:700">RF4 Community</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>
          ${body}
          <p style="margin:24px 0 0;color:#667680;font-size:12px;line-height:1.5">Если вы не выполняли это действие, просто проигнорируйте письмо.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function codeBlock(code: string) {
    return `<div style="margin:20px 0;padding:16px;border-radius:8px;background:#edf7fa;text-align:center;font-size:30px;font-weight:700;letter-spacing:6px">${escapeHtml(code)}</div>`;
}

function actionButton(label: string, url: string) {
    return `<p style="margin:22px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 18px;border-radius:7px;background:#087da2;color:#ffffff;text-decoration:none;font-weight:700">${escapeHtml(label)}</a></p>`;
}

export function buildAuthEmail(type: AuthEmailType, value: string): EmailContent {
    if (type === "signup-otp") {
        const title = "Подтверждение email";
        return {
            subject: "Код подтверждения RF4 Community",
            text: `Код подтверждения: ${value}\n\nКод действует 10 минут. Если вы не регистрировались, проигнорируйте письмо.`,
            html: emailLayout(title, `<p style="margin:0;line-height:1.6">Введите этот код на сайте. Код действует 10 минут.</p>${codeBlock(value)}`),
        };
    }

    if (type === "password-change-code") {
        const title = "Подтверждение смены пароля";
        return {
            subject: "Код смены пароля RF4 Community",
            text: `Код подтверждения смены пароля: ${value}\n\nКод действует 10 минут. Если вы не меняли пароль, проигнорируйте письмо.`,
            html: emailLayout(title, `<p style="margin:0;line-height:1.6">Введите этот код на сайте. Код действует 10 минут.</p>${codeBlock(value)}`),
        };
    }

    if (type === "password-reset") {
        const title = "Восстановление пароля";
        return {
            subject: "Восстановление пароля RF4 Community",
            text: `Чтобы установить новый пароль, откройте ссылку:\n${value}\n\nСсылка действует 1 час.`,
            html: emailLayout(title, `<p style="margin:0;line-height:1.6">Вы запросили восстановление пароля. Ссылка действует 1 час.</p>${actionButton("Установить новый пароль", value)}`),
        };
    }

    const title = "Подтверждение email";
    return {
        subject: "Подтвердите email в RF4 Community",
        text: `Чтобы подтвердить email, откройте ссылку:\n${value}`,
        html: emailLayout(title, `<p style="margin:0;line-height:1.6">Подтвердите адрес электронной почты, чтобы завершить настройку аккаунта.</p>${actionButton("Подтвердить email", value)}`),
    };
}

function emailMode() {
    const mode = process.env.EMAIL_TRANSPORT?.trim().toLowerCase() || (process.env.NODE_ENV === "production" ? "smtp" : "console");
    if (mode !== "console" && mode !== "smtp") {
        throw new Error("EMAIL_TRANSPORT must be either console or smtp");
    }
    return mode;
}

function requiredEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required when EMAIL_TRANSPORT=smtp`);
    return value;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
    if (value === undefined || value.trim() === "") return fallback;
    return value.trim().toLowerCase() === "true";
}

function getSmtpTransporter() {
    if (smtpTransporter) return smtpTransporter;

    const port = Number(process.env.SMTP_PORT?.trim() || "1127");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("SMTP_PORT must be a valid TCP port");
    }

    const secure = parseBoolean(process.env.SMTP_SECURE, port === 465 || port === 1127);
    smtpTransporter = nodemailer.createTransport({
        host: requiredEnv("SMTP_HOST"),
        port,
        secure,
        requireTLS: !secure,
        auth: {
            user: requiredEnv("SMTP_USER"),
            pass: requiredEnv("SMTP_PASSWORD"),
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    });

    return smtpTransporter;
}

async function auditEmail(type: AuthEmailType, email: string, status: "sent" | "failed", delivery: "console" | "smtp", error?: unknown) {
    await writeAuditLog({
        action: `email.${type}.${status}`,
        targetEmail: email,
        outcome: status === "failed" ? "failure" : "success",
        metadata: {
            delivery,
            ...(error instanceof Error ? { error: error.message.slice(0, 300) } : {}),
        },
    }).catch((auditError) => {
        console.warn("Failed to write auth email audit log", auditError);
    });
}

export async function sendAuthEmail(type: AuthEmailType, email: string, value: string) {
    const mode = emailMode();

    if (mode === "console") {
        console.info(`[auth-email:${type}] ${email}: ${value}`);
        await auditEmail(type, email, "sent", "console");
        return;
    }

    try {
        const content = buildAuthEmail(type, value);
        await getSmtpTransporter().sendMail({
            from: requiredEnv("EMAIL_FROM"),
            to: email,
            ...(process.env.EMAIL_REPLY_TO?.trim() ? { replyTo: process.env.EMAIL_REPLY_TO.trim() } : {}),
            subject: content.subject,
            text: content.text,
            html: content.html,
        });
        await auditEmail(type, email, "sent", "smtp");
    } catch (error) {
        await auditEmail(type, email, "failed", "smtp", error);
        throw error;
    }
}

export async function verifyEmailTransport() {
    if (emailMode() === "console") return "console" as const;
    await getSmtpTransporter().verify();
    return "smtp" as const;
}

export async function sendTestEmail(email: string) {
    if (emailMode() !== "smtp") throw new Error("Set EMAIL_TRANSPORT=smtp before sending a test email");
    await getSmtpTransporter().sendMail({
        from: requiredEnv("EMAIL_FROM"),
        to: email,
        ...(process.env.EMAIL_REPLY_TO?.trim() ? { replyTo: process.env.EMAIL_REPLY_TO.trim() } : {}),
        subject: "Проверка почты RF4 Community",
        text: "SMTP настроен правильно. Это тестовое письмо RF4 Community.",
        html: emailLayout("Почта настроена", '<p style="margin:0;line-height:1.6">SMTP настроен правильно. Это тестовое письмо RF4 Community.</p>'),
    });
}
