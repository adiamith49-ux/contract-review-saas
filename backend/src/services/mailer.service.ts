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
  opts?: { replyTo?: string; html?: string },
): Promise<void> {
  await getTransporter().sendMail({
    from: config.SMTP_FROM || config.SMTP_USER,
    to,
    subject,
    text,
    html: opts?.html,
    replyTo: opts?.replyTo,
  });
}

// ─── Branded HTML email template ───────────────────────────────────────────
// Every transactional email in the app is built from these primitives so the
// layout, spacing and palette stay identical across all 8 email types.
// Table-based + inline-styled throughout — required for Outlook/Gmail, which
// strip <style> blocks and ignore most CSS layout properties.

const BRAND = {
  deepLagoon: "#0F2A2A",
  tealWave: "#00BFA6",
  tealWaveDark: "#00A190",
  aquaSilk: "#D9FAF4",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f0f4f3",
};

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turns plain text with \n\n paragraph breaks into safely-escaped <p> blocks. */
export function emailParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .filter((block) => block.trim().length > 0)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${BRAND.text};">${escapeHtml(
          block,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

/** Solid teal call-to-action button. */
export function emailButton(url: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
  <tr>
    <td bgcolor="${BRAND.tealWave}" style="border-radius:8px;">
      <a href="${escapeHtml(url)}" target="_blank"
         style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

/** Large centered code display, for OTP / reset codes. */
export function emailCodeBox(code: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 20px;">
  <tr>
    <td align="center" bgcolor="${BRAND.aquaSilk}" style="border-radius:10px;padding:20px;">
      <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.deepLagoon};">
        ${escapeHtml(code)}
      </span>
    </td>
  </tr>
</table>`;
}

/** Light key/value details card (ticket info, task info, obligation info, …). */
export function emailInfoBox(
  rows: { label: string; value: string }[],
  opts?: { title?: string },
): string {
  const title = opts?.title
    ? `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(
        opts.title,
      )}</p>`
    : "";
  const rowsHtml = rows
    .filter((r) => r.value)
    .map(
      (r) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${BRAND.muted};white-space:nowrap;vertical-align:top;width:120px;">${escapeHtml(
          r.label,
        )}</td>
        <td style="padding:6px 0;font-size:13px;color:${BRAND.text};font-weight:500;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="margin:4px 0 20px;background:#f8fafa;border:1px solid ${BRAND.border};border-radius:10px;">
  <tr>
    <td style="padding:16px 18px;">
      ${title}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${rowsHtml}
      </table>
    </td>
  </tr>
</table>`;
}

/** A muted note/quote block (e.g. "note from our team", ticket description). */
export function emailNoteBox(text: string, opts?: { label?: string }): string {
  const label = opts?.label
    ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(
        opts.label,
      )}</p>`
    : "";
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;">
  <tr>
    <td style="border-left:3px solid ${BRAND.tealWave};padding:2px 0 2px 14px;">
      ${label}
      <p style="margin:0;font-size:13.5px;line-height:1.6;color:${BRAND.text};white-space:pre-wrap;">${escapeHtml(
        text,
      )}</p>
    </td>
  </tr>
</table>`;
}

/**
 * Wraps a pre-built inner HTML body (paragraphs/buttons/boxes above) in the
 * shared Contralyne header/footer shell. `preheader` is the hidden preview
 * text shown next to the subject line in inbox lists.
 */
export function wrapEmail(bodyHtml: string, opts?: { preheader?: string }): string {
  const preheader = opts?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
        opts.preheader,
      )}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Contralyne</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560"
                 style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td bgcolor="${BRAND.deepLagoon}" style="padding:22px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${BRAND.tealWave};margin-right:9px;"></span>
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Contralyne</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:18px 32px 26px;border-top:1px solid ${BRAND.border};">
                <p style="margin:0 0 4px;font-size:12px;color:${BRAND.muted};">
                  Contralyne — AI-assisted contract review
                </p>
                <p style="margin:0;font-size:11px;color:#9ca3af;">
                  This is an automated message. AI-generated insights are for informational purposes only and do not constitute legal advice.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
