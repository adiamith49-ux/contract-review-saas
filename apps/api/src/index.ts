import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { contractsRouter } from "./routes/contracts.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.WEB_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/contracts", contractsRouter);
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT}`);
});
