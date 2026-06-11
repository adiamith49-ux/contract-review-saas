import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

// GET /api/analytics — dashboard stats for the current user
analyticsRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.userId;

    const [contracts, analyses, recentActivity] = await Promise.all([
      db
        .from("contracts")
        .select("id, contract_type, status, created_at")
        .eq("user_id", userId),

      db
        .from("analyses")
        .select("risk_level, created_at")
        .eq("user_id", userId),

      db
        .from("activity_logs")
        .select("id, action, entity_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (contracts.error) throw contracts.error;
    if (analyses.error) throw analyses.error;

    const contractData = contracts.data ?? [];
    const analysisData = analyses.data ?? [];

    // ── totals ────────────────────────────────────────────────────────────
    const totalContracts = contractData.length;
    const totalAnalyzed  = contractData.filter((c) => c.status === "analyzed").length;
    const highRiskCount  = analysisData.filter(
      (a) => a.risk_level === "high" || a.risk_level === "critical",
    ).length;
    const pendingCount   = contractData.filter(
      (c) => c.status === "uploaded" || c.status === "processing",
    ).length;

    // ── by_status (array) ─────────────────────────────────────────────────
    const statusMap = contractData.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
    const by_status = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    // ── by_type (array) ───────────────────────────────────────────────────
    const typeMap = contractData.reduce<Record<string, number>>((acc, c) => {
      acc[c.contract_type] = (acc[c.contract_type] ?? 0) + 1;
      return acc;
    }, {});
    const by_type = Object.entries(typeMap).map(([contract_type, count]) => ({ contract_type, count }));

    // ── by_risk (array) ───────────────────────────────────────────────────
    const riskMap = analysisData.reduce<Record<string, number>>((acc, a) => {
      acc[a.risk_level] = (acc[a.risk_level] ?? 0) + 1;
      return acc;
    }, {});
    const by_risk = Object.entries(riskMap).map(([risk_level, count]) => ({ risk_level, count }));

    // ── uploads_per_month (array, last 6 months, sorted) ─────────────────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthMap = contractData
      .filter((c) => new Date(c.created_at) >= sixMonthsAgo)
      .reduce<Record<string, number>>((acc, c) => {
        const month = c.created_at.slice(0, 7); // YYYY-MM
        acc[month] = (acc[month] ?? 0) + 1;
        return acc;
      }, {});

    const uploads_per_month = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    // ── recent_activity ───────────────────────────────────────────────────
    const recent_activity = (recentActivity.data ?? []).map((a) => ({
      id:          a.id ?? "",
      action:      a.action ?? "",
      entity_type: a.entity_type ?? "",
      created_at:  a.created_at ?? "",
    }));

    res.json({
      totals: {
        total:     totalContracts,
        analyzed:  totalAnalyzed,
        high_risk: highRiskCount,
        pending:   pendingCount,
      },
      by_status,
      by_type,
      by_risk,
      uploads_per_month,
      recent_activity,
    });
  } catch (err) {
    next(err);
  }
});
