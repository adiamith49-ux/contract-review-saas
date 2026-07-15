import ExcelJS from "exceljs";
import { db } from "../db.js";

// ─── Shared styling ───────────────────────────────────────────────────────────

const BRAND_DARK = "FF1E293B";
const TEXT_DARK = "FF0F172A";
const BORDER_LIGHT = "FFE2E8F0";
const ZEBRA = "FFF8FAFC";

const RISK_FILLS: Record<string, string> = {
  low: "FFD1FAE5",
  medium: "FFFEF3C7",
  high: "FFFFEDD5",
  critical: "FFFEE2E2",
};

const RISK_FONTS: Record<string, string> = {
  low: "FF047857",
  medium: "FFB45309",
  high: "FFC2410C",
  critical: "FFB91C1C",
};

const STATUS_FILLS: Record<string, string> = {
  uploaded: "FFDBEAFE",
  processing: "FFEDE9FE",
  analyzed: "FFD1FAE5",
  failed: "FFFEE2E2",
};

function addSheetTitle(ws: ExcelJS.Worksheet, title: string, span: number): void {
  ws.mergeCells(1, 1, 1, span);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: TEXT_DARK } };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, span);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Generated ${new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}`;
  subCell.font = { size: 9, color: { argb: "FF64748B" } };
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_DARK } };
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });
  row.height = 20;
}

function styleDataRow(row: ExcelJS.Row, zebra: boolean): void {
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    cell.font = { size: 10, color: { argb: "FF334155" } };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_LIGHT } } };
    cell.alignment = { vertical: "middle" };
  });
}

// Simple two-column-or-more table starting at row 4 (rows 1–2 hold the title block)
function addTable(
  ws: ExcelJS.Worksheet,
  headers: string[],
  widths: number[],
  rows: (string | number)[][],
): void {
  ws.columns = widths.map((width) => ({ width }));
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleHeaderRow(headerRow);
  rows.forEach((r, idx) => {
    const row = ws.getRow(5 + idx);
    r.forEach((v, i) => { row.getCell(i + 1).value = v; });
    styleDataRow(row, idx % 2 === 1);
  });
}

// Supabase types to-one joins as arrays; runtime shape can be either
function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

const TYPE_LABELS: Record<string, string> = {
  nda: "NDA",
  msa: "MSA",
  saas: "SaaS Agreement",
  sow: "Statement of Work",
  order_form: "Order Form",
  employment: "Employment",
  vendor_agreement: "Vendor Agreement",
  other: "Other",
};

const typeLabel = (t: string) => TYPE_LABELS[t] ?? cap(t);

// ─── Dashboard report ─────────────────────────────────────────────────────────
// Platform-wide overview: totals + every chart shown on the admin dashboard.

export async function buildDashboardReport(): Promise<Buffer> {
  const [clientsRes, usersRes, contractsRes, analysesRes, ticketsRes] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }),
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("contracts").select("status, contract_type, created_at"),
    db.from("analyses").select("risk_level"),
    db.from("tickets").select("status"),
  ]);

  const contracts = contractsRes.data ?? [];
  const analyses = analysesRes.data ?? [];
  const tickets = ticketsRes.data ?? [];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Contralyne";
  wb.created = new Date();

  // Summary sheet
  const summary = wb.addWorksheet("Summary");
  addSheetTitle(summary, "Contralyne — Dashboard Report", 2);
  addTable(summary, ["Metric", "Value"], [34, 14], [
    ["Clients", clientsRes.count ?? 0],
    ["Users", usersRes.count ?? 0],
    ["Contracts", contracts.length],
    ["Analyzed contracts", contracts.filter((c) => c.status === "analyzed").length],
    ["High / critical risk analyses", analyses.filter((a) => a.risk_level === "high" || a.risk_level === "critical").length],
    ["Open tickets", tickets.filter((t) => t.status === "open").length],
    ["Resolved tickets", tickets.filter((t) => t.status === "resolved").length],
  ]);

  // Uploads by month (last 6 months, zero-filled)
  const uploadRows: (string | number)[][] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    uploadRows.push([
      d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      contracts.filter((c) => (c.created_at as string).slice(0, 7) === key).length,
    ]);
  }
  const uploads = wb.addWorksheet("Uploads by Month");
  addSheetTitle(uploads, "Contract Uploads — Last 6 Months", 2);
  addTable(uploads, ["Month", "Uploads"], [24, 12], uploadRows);

  // Risk breakdown with colored cells
  const risk = wb.addWorksheet("Risk Breakdown");
  addSheetTitle(risk, "AI Risk Breakdown — Analyzed Contracts", 2);
  const riskRows = (["low", "medium", "high", "critical"] as const).map((level) => [
    cap(level),
    analyses.filter((a) => a.risk_level === level).length,
  ]);
  addTable(risk, ["Risk Level", "Contracts"], [20, 12], riskRows);
  (["low", "medium", "high", "critical"] as const).forEach((level, idx) => {
    const cell = risk.getCell(5 + idx, 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RISK_FILLS[level] } };
    cell.font = { size: 10, bold: true, color: { argb: RISK_FONTS[level] } };
  });

  // Contracts by type
  const typeCounts = Object.entries(
    contracts.reduce<Record<string, number>>((acc, c) => {
      acc[c.contract_type] = (acc[c.contract_type] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const types = wb.addWorksheet("Contracts by Type");
  addSheetTitle(types, "Contracts by Type", 2);
  addTable(types, ["Contract Type", "Count"], [24, 12], typeCounts.map(([t, n]) => [typeLabel(t), n]));

  // Tickets by status
  const ticketSheet = wb.addWorksheet("Tickets");
  addSheetTitle(ticketSheet, "Support Tickets by Status", 2);
  addTable(ticketSheet, ["Status", "Count"], [20, 12],
    (["open", "in_progress", "resolved"] as const).map((s) => [cap(s), tickets.filter((t) => t.status === s).length]),
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── Contracts report ─────────────────────────────────────────────────────────
// Full register of every contract with client, owner, status, and AI risk.

export async function buildContractsReport(): Promise<Buffer> {
  const [contractsRes, usersRes] = await Promise.all([
    db
      .from("contracts")
      .select("user_id, filename, contract_type, status, file_size, created_at, clients(name), analyses(risk_level, created_at)")
      .order("created_at", { ascending: false }),
    db.from("users").select("clerk_user_id, email"),
  ]);

  const contracts = contractsRes.data ?? [];
  const emailByUser = new Map(
    (usersRes.data ?? []).map((u) => [u.clerk_user_id as string, u.email as string]),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Contralyne";
  wb.created = new Date();

  const ws = wb.addWorksheet("Contracts", { views: [{ state: "frozen", ySplit: 4 }] });
  addSheetTitle(ws, "Contralyne — Contracts Report", 9);

  const headers = ["Filename", "Client", "Uploaded By", "Type", "Status", "AI Risk", "Size (KB)", "Uploaded", "Analyzed"];
  const widths = [44, 22, 30, 18, 13, 12, 11, 13, 13];
  const rows = contracts.map((c) => {
    const analysis = one<{ risk_level: string; created_at: string }>(c.analyses);
    return [
      c.filename as string,
      one<{ name: string }>(c.clients)?.name ?? "—",
      emailByUser.get(c.user_id as string) ?? (c.user_id as string),
      typeLabel(c.contract_type as string),
      cap(c.status as string),
      analysis ? cap(analysis.risk_level) : "—",
      Math.round(((c.file_size as number) ?? 0) / 1024),
      (c.created_at as string).slice(0, 10),
      analysis ? analysis.created_at.slice(0, 10) : "—",
    ] as (string | number)[];
  });
  addTable(ws, headers, widths, rows);
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: headers.length } };

  // Color the status + risk cells like the app's badges
  contracts.forEach((c, idx) => {
    const rowIdx = 5 + idx;
    const statusFill = STATUS_FILLS[c.status as string];
    if (statusFill) {
      const cell = ws.getCell(rowIdx, 5);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    }
    const riskLevel = one<{ risk_level: string }>(c.analyses)?.risk_level;
    if (riskLevel && RISK_FILLS[riskLevel]) {
      const cell = ws.getCell(rowIdx, 6);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RISK_FILLS[riskLevel] } };
      cell.font = { size: 10, bold: true, color: { argb: RISK_FONTS[riskLevel] } };
    }
  });

  // Small summary sheet at the end
  const summary = wb.addWorksheet("Summary");
  addSheetTitle(summary, "Contracts Summary", 2);
  addTable(summary, ["Metric", "Value"], [30, 12], [
    ["Total contracts", contracts.length],
    ["Analyzed", contracts.filter((c) => c.status === "analyzed").length],
    ["Awaiting analysis", contracts.filter((c) => c.status === "uploaded").length],
    ["Processing", contracts.filter((c) => c.status === "processing").length],
    ["Failed", contracts.filter((c) => c.status === "failed").length],
  ]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
