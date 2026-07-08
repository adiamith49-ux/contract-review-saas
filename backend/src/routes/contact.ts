import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { contactLimiter } from "../middleware/rateLimit.js";
import { isMailerConfigured, sendMail } from "../services/mailer.service.js";

export const contactRouter = Router();

// POST /api/contact — public landing-page contact / demo-request form.
// Delivered to CONTACT_EMAIL with reply-to set to the submitter.
contactRouter.post("/", contactLimiter, async (req, res, next) => {
  try {
    const { name, email, firm, team_size, message } = z.object({
      name: z.string().min(1).max(200),
      email: z.string().email().max(320),
      firm: z.string().min(1).max(200),
      team_size: z.string().max(50).optional(),
      message: z.string().min(1).max(5000),
    }).parse(req.body);

    if (!isMailerConfigured()) {
      res.status(503).json({ error: "Contact form is temporarily unavailable. Please email us directly." });
      return;
    }

    await sendMail(
      config.CONTACT_EMAIL,
      `Contralyne enquiry — ${firm} (${name})`,
      `New enquiry from the Contralyne landing page:

Name:       ${name}
Work email: ${email}
Firm:       ${firm}
Team size:  ${team_size || "not specified"}

Message:
${message}

—
Reply directly to this email to respond to ${name}.`,
      { replyTo: email },
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
