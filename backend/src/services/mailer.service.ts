import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config.js";

export function isMailerConfigured(): boolean {
  return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  opts?: { replyTo?: string },
): Promise<void> {
  await getTransporter().sendMail({
    from: config.SMTP_FROM || config.SMTP_USER,
    to,
    subject,
    text,
    replyTo: opts?.replyTo,
  });
}
