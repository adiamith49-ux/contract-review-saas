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
        .select("action, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (contracts.error) throw contracts.error;
    if (analyses.error) throw analyses.error;

    const contractData = contracts.data ?? [];
    const analysisData = analyses.data ?? [];

    // Contracts by status
    const byStatus = contractData.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});

    // Contracts by type
    const byType = contractData.reduce<Record<string, number>>((acc, c) => {
      acc[c.contract_type] = (acc[c.contract_type] ?? 0) + 1;
      return acc;
    }, {});

    // Analyses by risk level
    const byRisk = analysisData.reduce<Record<string, number>>((acc, a) => {
      acc[a.risk_level] = (acc[a.risk_level] ?? 0) + 1;
      return acc;
    }, {});

    // Uploads per month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const uploadsPerMonth = contractData
      .filter((c) => new Date(c.created_at) >= sixMonthsAgo)
      .reduce<Record<string, number>>((acc, c) => {
        const month = c.created_at.slice(0, 7); // YYYY-MM
        acc[month] = (acc[month] ?? 0) + 1;
        return acc;
      }, {});

    res.json({
      summary: {
        totalContracts: contractData.length,
        totalAnalyses: analysisData.length,
        analyzedRate: contractData.length > 0
          ? Math.round((analysisData.length / contractData.length) * 100)
          : 0,
      },
      byStatus,
      byType,
      byRisk,
      uploadsPerMonth,
      recentActivity: recentActivity.data ?? [],
    });
  } catch (err) {
    next(err);
  }
});
