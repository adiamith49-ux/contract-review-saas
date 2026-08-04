import { Router } from "express";
import { db } from "../db.js";
import { config } from "../config.js";
import { isMailerConfigured, sendMail } from "../services/mailer.service.js";

// Scheduled jobs — invoked by Vercel Cron (see backend/vercel.json's "crons"
// entry), never by a user. Vercel automatically sends `Authorization: Bearer
// <CRON_SECRET>` when that env var is set, which is how this is protected —
// no route here should ever be reachable by an ordinary authenticated user.
export const cronRouter = Router();

function isAuthorized(req: import("express").Request): boolean {
  const expected = config.CRON_SECRET;
  if (!expected) return config.NODE_ENV !== "production"; // dev/local only, unset in prod fails closed
  return req.headers.authorization === `Bearer ${expected}`;
}

const TYPE_LABELS: Record<string, string> = {
  milestone_payment: "Milestone payment",
  certificate_submission: "Certificate submission",
  board_update: "Board update",
  periodic_deliverable: "Periodic deliverable",
  other: "Obligation",
};

// GET /api/cron/obligation-reminders — daily. Emails whoever created each
// pending obligation once its due date enters its own reminder window
// (reminder_days_before), then stamps reminder_sent_at so it never re-sends.
cronRouter.get("/obligation-reminders", async (req, res, next) => {
  if (!isAuthorized(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const { data: obligations, error } = await db
      .from("contract_obligations")
      .select("id, user_id, title, type, due_date, reminder_days_before, contracts(filename)")
      .eq("status", "pending")
      .is("reminder_sent_at", null);
    if (error) throw error;

    const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const due = (obligations ?? []).filter((o) => {
      const daysUntil = Math.round((new Date(o.due_date as string).getTime() - todayMs) / 86400000);
      return daysUntil <= (o.reminder_days_before as number);
    });

    let sent = 0;
    if (due.length > 0 && isMailerConfigured()) {
      const userIds = [...new Set(due.map((o) => o.user_id as string))];
      const { data: users } = await db.from("users").select("clerk_user_id, email").in("clerk_user_id", userIds);
      const emailByUser = new Map((users ?? []).map((u) => [u.clerk_user_id as string, u.email as string]));

      for (const o of due) {
        const email = emailByUser.get(o.user_id as string);
        if (!email) continue;
        const contractName = (o as any).contracts?.filename ?? "your contract";
        const overdue = new Date(o.due_date as string).getTime() < todayMs;
        try {
          await sendMail(
            email,
            `${overdue ? "Overdue" : "Reminder"}: ${o.title} — due ${o.due_date}`,
            `Hi,

${overdue ? "This is now overdue:" : "This is coming up:"}

${TYPE_LABELS[o.type as string] ?? "Obligation"}: ${o.title}
Contract:  ${contractName}
Due date:  ${new Date(o.due_date as string).toDateString()}

View it on Contralyne: ${config.WEB_URL}/contracts/

— The Contralyne Team`,
          );
          await db.from("contract_obligations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", o.id);
          sent++;
        } catch (mailErr) {
          console.error("[cron/obligation-reminders] mail failed for", email, mailErr);
        }
      }
    }

    res.json({ checked: obligations?.length ?? 0, due: due.length, sent });
  } catch (err) {
    next(err);
  }
});
