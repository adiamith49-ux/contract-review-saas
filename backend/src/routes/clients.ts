import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

// GET /api/clients — all active clients (V1: no multi-tenant, all users see all clients)
clientsRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("clients")
      .select("id, name, industry, notes, status, created_at, updated_at")
      .eq("status", "active")
      .order("name");

    if (error) throw error;

    // Count contracts per client
    const clientIds = (data ?? []).map((c: any) => c.id);
    const counts: Record<string, number> = {};
    if (clientIds.length > 0) {
      const { data: countRows } = await db
        .from("contracts")
        .select("client_id")
        .in("client_id", clientIds);
      for (const row of countRows ?? []) {
        if (row.client_id) counts[row.client_id] = (counts[row.client_id] ?? 0) + 1;
      }
    }

    res.json({
      clients: (data ?? []).map((c: any) => ({ ...c, contract_count: counts[c.id] ?? 0 })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/clients — create a new client
clientsRouter.post("/", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(200),
      industry: z.string().max(100).optional(),
      notes: z.string().max(2000).optional(),
    }).parse(req.body);

    const { data, error } = await db
      .from("clients")
      .insert({ ...body, status: "active" })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ client: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/:id — client detail
clientsRouter.get("/:id", async (req, res, next) => {
  try {
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
