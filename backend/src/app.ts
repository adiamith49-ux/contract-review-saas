import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { accountRouter } from "./routes/account.js";
import { activityRouter } from "./routes/activity.js";
import { adminRouter } from "./routes/admin.js";
import { approvalsRouter } from "./routes/approvals.js";
import { clientsRouter } from "./routes/clients.js";
import { ticketsRouter } from "./routes/tickets.js";
import { analyticsRouter } from "./routes/analytics.js";
import { calendarRouter } from "./routes/calendar.js";
import { clausesRouter } from "./routes/clauses.js";
import { contactRouter } from "./routes/contact.js";
import { commentsRouter } from "./routes/comments.js";
import { contractsRouter } from "./routes/contracts.js";
import { rulesRouter } from "./routes/rules.js";
import { tasksRouter } from "./routes/tasks.js";
import { timeRouter } from "./routes/time.js";
import { webhooksRouter } from "./routes/webhooks.js";

const app = express();

app.use(helmet());
// Two allowed origins in production: the app (app.contralyne.com) and the
// landing site (contralyne.com — its contact form posts to this API)
const corsOrigins = Array.from(new Set([config.WEB_URL, config.LANDING_URL].filter(Boolean)));
app.use(cors({ origin: corsOrigins, credentials: true }));

// Webhooks must be registered BEFORE express.json() — svix needs the raw body for signature verification
app.use("/api/webhooks", webhooksRouter);

app.use(express.json({ limit: "1mb" }));
app.use(generalLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/admin", adminRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/contracts", commentsRouter); // comments/team paths — must not overlap contractsRouter
app.use("/api/contracts", contractsRouter);
app.use("/api/clauses", clausesRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/account", accountRouter);
app.use("/api/contact", contactRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/time", timeRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/approvals", approvalsRouter);

app.use(errorHandler);

export default app;
