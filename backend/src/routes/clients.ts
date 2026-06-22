import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getUserClientIds } from "../services/membership.service.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

// GET /api/clients — clients the user is assigned to
clientsRouter.get("/", async (req, res, next) => {
  try {
    const clientIds = await getUserClientIds(req.userId);
    if (clientIds.length === 0) {
      res.json({ clients: [] });
      return;
    }

    const { data, error } = await db
      .from("clients")
      .select("id, name, industry, notes, status, created_at, updated_at")
      .in("id", clientIds)
      .order("name");

    if (error) throw error;

    const { data: countRows } = await db
      .from("contracts")
      .select("client_id")
      .in("client_id", clientIds);

    const counts: Record<string, number> = {};
    for (const row of countRows ?? []) {
      if (row.client_id) counts[row.client_id] = (counts[row.client_id] ?? 0) + 1;
    }

    res.json({
      clients: (data ?? []).map((c: any) => ({ ...c, contract_count: counts[c.id] ?? 0 })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/:id — client detail (must be assigned)
clientsRouter.get("/:id", async (req, res, next) => {
  try {
    const clientIds = await getUserClientIds(req.userId);
    if (!clientIds.includes(req.params.id)) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const { data, error } = await db
      .from("clients")
      .select("id, name, industry, notes, status, created_at, updated_at")
      .eq("id", req.params.id)
      .single();

    if (error || !data) { res.status(404).json({ error: "Client not found" }); return; }

    const { data: contractRows } = await db
      .from("contracts")
      .select("id, filename, contract_type, status, file_size, created_at, analyses(id, risk_level)")
      .eq("client_id", req.params.id)
      .order("created_at", { ascending: false });

    const contracts = (contractRows ?? []).map((c: any) => ({
      ...c,
      analyses: Array.isArray(c.analyses) ? c.analyses : (c.analyses ? [c.analyses] : []),
    }));

    res.json({ client: data, contracts });
  } catch (err) {
    next(err);
  }
});
