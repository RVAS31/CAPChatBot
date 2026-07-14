// srv/actions/sendEmail.js

const nodemailer = require("nodemailer");

function getSmtpConfiguration() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
        String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM || user;

    if (!host) {
        throw new Error("SMTP_HOST is not configured.");
    }

    if (!user) {
        throw new Error("SMTP_USER is not configured.");
    }

    if (!password) {
        throw new Error("SMTP_PASSWORD is not configured.");
    }

    if (!from) {
        throw new Error("SMTP_FROM is not configured.");
    }

    return {
        host,
        port,
        secure,
        user,
        password,
        from
    };
}

function createTransporter(configuration) {
    return nodemailer.createTransport({
        host: configuration.host,
        port: configuration.port,
        secure: configuration.secure,
        auth: {
            user: configuration.user,
            pass: configuration.password
        }
    });
}

async function sendEmail({ to, subject, body }) {
    if (!to?.trim()) {
        throw new Error("Email recipient is required.");
    }

    if (!subject?.trim()) {
        throw new Error("Email subject is required.");
    }

    if (!body?.trim()) {
        throw new Error("Email body is required.");
    }

    const configuration = getSmtpConfiguration();
    const transporter = createTransporter(configuration);

    const result = await transporter.sendMail({
        from: configuration.from,
        to: to.trim(),
        subject: subject.trim(),
        text: body.trim()
    });

    console.log("Email sent successfully:", {
        messageId: result.messageId,
        recipient: to
    });

    return {
        messageId: result.messageId,
        accepted: result.accepted || [],
        rejected: result.rejected || []
    };
}

module.exports = {
    sendEmail
};