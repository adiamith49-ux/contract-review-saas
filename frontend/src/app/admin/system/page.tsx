"use client";
import { useEffect, useState } from "react";
import {
  Server, Database, HardDrive, Sparkles, Lock, Mail, CheckCircle2, XCircle,
  GitBranch, ArrowRight, ShieldCheck, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getSystemInfo, type SystemInfo } from "@/lib/admin-api";

// Human-readable descriptions of each core entity (matches packages/database/schema.sql)
const TABLE_DOCS: Record<string, string> = {
  users:              "Clerk user mirror (identity)",
  clients:            "Client/org grouping for contracts",
  contracts:          "Uploaded files + metadata + versions",
  legal_intake:       "Deal context: counterparty, jurisdiction, value",
  analyses:           "AI review results (JSONB)",
  chat_messages:      "Per-contract Q&A history",
  clause_library:     "Approved / fallback / walk-away clauses",
  review_rules:       "Playbooks (jurisdiction-tagged)",
  contract_comments:  "Matter collaboration comments + mentions",
  contract_approvals: "Approval chain steps + decisions",
  approval_rules:     "Approval matrix (value/risk/dept routing)",
  redlines:           "AI-generated tracked-change edits",
  tasks:              "Matter tasks + assignees",
  activity_logs:      "Full audit trail",
};

const FLOW = [
  { label: "Frontend", sub: "Next.js · Vercel", icon: Server },
  { label: "API Layer", sub: "Express + TypeScript", icon: ArrowRight },
  { label: "Database", sub: "Supabase / PostgreSQL", icon: Database },
  { label: "File Storage", sub: "AWS S3 (pre-signed)", icon: HardDrive },
  { label: "AI Provider", sub: "Anthropic Claude", icon: Sparkles },
  { label: "Export Engine", sub: "DOCX / PDF redlines", icon: GitBranch },
];

const API_GROUPS = [
  { path: "/api/contracts", desc: "Upload, analyze, summarize, redline, export, chat" },
  { path: "/api/approvals", desc: "Approval matrix + submit/decide/history" },
  { path: "/api/clauses · /api/rules", desc: "Clause library + jurisdiction playbooks" },
  { path: "/api/tasks · /api/activity", desc: "Matter tasks + audit timeline" },
  { path: "/api/analytics", desc: "Dashboard KPIs from live data" },
  { path: "/admin/*", desc: "Admin-gated management (separate JWT)" },
];

export default function AdminSystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setInfo(await getSystemInfo());
    } catch {
      toast.error("Failed to load system info");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const services = info ? [
    { key: "database", icon: Database,  detail: info.services.database.provider, ok: info.services.database.connected },
    { key: "storage",  icon: HardDrive, detail: `${info.services.storage.provider} · ${info.services.storage.bucket} · ${info.services.storage.region}`, ok: info.services.storage.configured },
    { key: "ai",       icon: Sparkles,  detail: `${info.services.ai.provider} · ${info.services.ai.model}`, ok: info.services.ai.configured },
    { key: "auth",     icon: Lock,      detail: info.services.auth.provider, ok: info.services.auth.configured },
    { key: "email",    icon: Mail,      detail: info.services.email.provider, ok: info.services.email.configured },
  ] : [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" /> System & Architecture
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live infrastructure health, data model, and API structure — the technical foundation.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {info && (
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              info.status === "healthy" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
            )}>
              <span className={cn("h-2 w-2 rounded-full", info.status === "healthy" ? "bg-emerald-500" : "bg-amber-500")} />
              {info.status === "healthy" ? "All systems operational" : "Degraded"}
              <span className="text-gray-400 font-normal ml-1">· {info.environment}</span>
            </span>
          )}
          <button onClick={load} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Architecture flow */}
      <section className="rounded-xl border bg-white shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Request Flow</h2>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {FLOW.map((f, i) => (
            <div key={f.label} className="flex items-center gap-2 shrink-0">
              <div className="rounded-lg border bg-gray-50/70 px-3 py-2.5 min-w-[130px]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <f.icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-gray-800">{f.label}</span>
                </div>
                <p className="text-[10px] text-gray-500">{f.sub}</p>
              </div>
              {i < FLOW.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
            </div>
          ))}
        </div>
      </section>

      {/* Service health */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          : services.map(s => (
            <div key={s.key} className="rounded-xl border bg-white shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <s.icon className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800 capitalize">{s.key}</span>
                </div>
                {s.ok
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  : <XCircle className="h-4 w-4 text-gray-300 shrink-0" />}
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 truncate" title={s.detail}>{s.detail}</p>
              <p className={cn("text-[10px] font-medium mt-1", s.ok ? "text-emerald-600" : "text-gray-400")}>
                {s.ok ? "Connected / configured" : "Not configured"}
              </p>
            </div>
          ))}
      </section>

      {/* Secrets management */}
      {info && (
        <section className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Secrets management</p>
            <p className="text-xs text-emerald-800 mt-0.5">{info.secrets_managed_via}</p>
          </div>
        </section>
      )}

      {/* Data model */}
      <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-gray-700">Data Model — structured tables (live row counts)</h2>
        </div>
        <div className="grid sm:grid-cols-2">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="px-5 py-3"><Skeleton className="h-4 w-full" /></div>)
            : (info?.tables ?? []).map((t) => (
              <div key={t.table} className="flex items-center justify-between px-5 py-2.5 border-b">
                <div className="min-w-0">
                  <code className="text-xs font-semibold text-gray-800">{t.table}</code>
                  <p className="text-[10px] text-gray-400 truncate">{TABLE_DOCS[t.table] ?? ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-gray-600 tabular-nums">{t.rows.toLocaleString()}</span>
                  {t.ok
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* API structure + deployment */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">API Structure</h2>
          <ul className="space-y-2">
            {API_GROUPS.map(g => (
              <li key={g.path} className="text-xs">
                <code className="font-semibold text-primary">{g.path}</code>
                <p className="text-gray-500 mt-0.5">{g.desc}</p>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-400 mt-3">
            All user routes require a Clerk JWT; every query is scoped to the authenticated user. Admin routes use a separate JWT.
          </p>
        </section>

        <section className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Deployment & Extensibility</h2>
          <ul className="space-y-2 text-xs text-gray-600">
            <li className="flex gap-2"><GitBranch className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" /><span>Git push to <code>main</code> → Vercel auto-builds & deploys frontend + API separately.</span></li>
            <li className="flex gap-2"><ShieldCheck className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" /><span>Source lives in the founder-owned GitHub repository; IP transfers on final payment.</span></li>
            <li className="flex gap-2"><Sparkles className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" /><span>AI provider is isolated in <code>ai.service.ts</code> — Anthropic can be swapped or an OpenAI/DocuSign layer added without touching routes.</span></li>
            <li className="flex gap-2"><Database className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" /><span>New modules (points 7–12) were added as new tables + routers with zero rebuild — the schema grows additively.</span></li>
          </ul>
        </section>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Built on AWS, Clerk, Supabase, and Vercel — all independently SOC 2 certified. Contracts encrypted at rest and in transit.
      </p>
    </div>
  );
}
