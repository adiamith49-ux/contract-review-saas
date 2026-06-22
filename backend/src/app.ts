import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { accountRouter } from "./routes/account.js";
import { activityRouter } from "./routes/activity.js";
import { adminRouter } from "./routes/admin.js";
import { clientsRouter } from "./routes/clients.js";
import { ticketsRouter } from "./routes/tickets.js";
import { analyticsRouter } from "./routes/analytics.js";
import { calendarRouter } from "./routes/calendar.js";
import { clausesRouter } from "./routes/clauses.js";
import { contractsRouter } from "./routes/contracts.js";
import { rulesRouter } from "./routes/rules.js";
import { tasksRouter } from "./routes/tasks.js";
import { timeRouter } from "./routes/time.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.WEB_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(generalLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/admin", adminRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/contracts", contractsRouter);
app.use("/api/clauses", clausesRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/account", accountRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/time", timeRouter);
app.use("/api/calendar", calendarRouter);

app.use(errorHandler);

export default app;
