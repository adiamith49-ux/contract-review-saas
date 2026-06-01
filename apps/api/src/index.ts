import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { analyticsRouter } from "./routes/analytics.js";
import { clausesRouter } from "./routes/clauses.js";
import { contractsRouter } from "./routes/contracts.js";
import { rulesRouter } from "./routes/rules.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.WEB_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/contracts", contractsRouter);
app.use("/api/clauses", clausesRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/analytics", analyticsRouter);

app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT}`);
});
