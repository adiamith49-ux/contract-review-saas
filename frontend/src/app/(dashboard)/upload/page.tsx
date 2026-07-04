"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Upload, X, Loader2, Gavel, CheckSquare, Square,
  ExternalLink, CheckCircle2, Building2, ChevronRight, ChevronLeft,
  User, Calendar, DollarSign, Globe, FileText,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { ContractType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { uploadContract, analyzeContract, listRules, listClients, extractMeta, type ReviewRule, type Client } from "@/lib/api";
import { formatFileSize, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

const JURISDICTION_OPTIONS = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "eu", label: "European Union" },
  { value: "india", label: "India" },
  { value: "other", label: "Other" },
];

const BUSINESS_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "in_negotiation", label: "In Negotiation" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "executed", label: "Executed" },
  { value: "on_hold", label: "On Hold" },
  { value: "terminated", label: "Terminated" },
];

type UploadStage = "idle" | "uploading" | "analyzing" | "done";

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [file, setFile]               = useState<File | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clients, setClients]         = useState<Client[]>([]);

  // Step 2
  const [title, setTitle]             = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [contractType, setContractType] = useState<ContractType>("other");
  const [contractStatus, setContractStatus] = useState("submitted");
  const [startDate, setStartDate]     = useState("");
  const [endDate, setEndDate]         = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [governingLaw, setGoverningLaw] = useState("us");
  const [ownerName, setOwnerName]     = useState("");
  const [contractValue, setContractValue] = useState("");

  // Step 3
  const [rules, setRules]                   = useState<ReviewRule[]>([]);
  const [rulesLoading, setRulesLoading]     = useState(true);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [playbookEnabled, setPlaybookEnabled] = useState(true);

  // AI field extraction
  const [extractingMeta, setExtractingMeta] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  // Processing
  const [stage, setStage]     = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const preselect = searchParams.get("client_id") ?? "";
    getToken().then(async token => {
      const [{ clients: c }, { rules: r }] = await Promise.all([
        listClients(token),
        listRules(token),
      ]);
      setClients(c);
      if (preselect && c.find(cl => cl.id === preselect)) {
        setSelectedClientId(preselect);
      } else if (c.length > 0) {
        setSelectedClientId(c[0].id);
      }
      const active = r.filter(rule => rule.is_active);
      setRules(active);
      setSelectedRuleIds(active.map(rule => rule.id));
    }).catch(() => {}).finally(() => setRulesLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleRule(id: string) {
    setSelectedRuleIds(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    setSelectedRuleIds(prev =>
      prev.length === rules.length ? [] : rules.map(r => r.id),
    );
  }

  const handleFile = (f: File) => {
    if (!ACCEPTED_MIME.includes(f.type)) {
      toast.error("Only PDF and DOCX files are supported");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));

    // Kick off background AI extraction
    setExtractingMeta(true);
    setAiFilledFields(new Set());
    getToken().then(token => extractMeta(token, f)).then(meta => {
      const filled = new Set<string>();
      if (meta.counterparty_name) { setCounterparty(meta.counterparty_name); filled.add("counterparty"); }
      if (meta.contract_type) {
        const normalized = meta.contract_type.toLowerCase().replace(/\s+/g, "_");
        let matched: ContractType = "other";
        if (normalized.includes("nda") || normalized.includes("non_disclosure") || normalized.includes("non-disclosure") || normalized.includes("confidentiality")) matched = "nda";
        else if (normalized.includes("msa") || normalized.includes("master_service")) matched = "msa";
        else if (normalized.includes("saas") || normalized.includes("subscription") || normalized.includes("software")) matched = "saas";
        else if (normalized.includes("sow") || normalized.includes("statement_of_work")) matched = "sow";
        else if (normalized.includes("order")) matched = "order_form";
        else if (normalized.includes("employ") || normalized.includes("offer_letter")) matched = "employment";
        else if (normalized.includes("vendor") || normalized.includes("supply") || normalized.includes("procurement")) matched = "vendor_agreement";
        setContractType(matched);
        filled.add("contractType");
      }
      if (meta.start_date) { setStartDate(meta.start_date); filled.add("startDate"); }
      if (meta.end_date) { setEndDate(meta.end_date); filled.add("endDate"); }
      if (meta.governing_law) {
        const gl = meta.governing_law.toLowerCase();
        if (gl.includes("uk") || gl.includes("england") || gl.includes("wales") || gl.includes("scotland")) setGoverningLaw("uk");
        else if (gl.includes("eu") || gl.includes("europe")) setGoverningLaw("eu");
        else if (gl.includes("india")) setGoverningLaw("india");
        else setGoverningLaw("us");
        filled.add("governingLaw");
      }
      if (meta.contract_value) { setContractValue(meta.contract_value); filled.add("contractValue"); }
      setAiFilledFields(filled);
    }).catch(() => {
      // silently ignore extraction failures
    }).finally(() => setExtractingMeta(false));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!file || !selectedClientId) return;
    const ruleIds = playbookEnabled ? selectedRuleIds : [];
    try {
      const token = await getToken();
      setStage("uploading");
      setProgress(30);
      const { contract } = await uploadContract(token, file, {
        contractType,
        clientId: selectedClientId,
        title: title.trim() || undefined,
        counterparty: counterparty.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        renewalDate: renewalDate || undefined,
        ownerName: ownerName.trim() || undefined,
        contractValue: contractValue ? Number(contractValue) : undefined,
        contractStatus,
        governingLaw: governingLaw || undefined,
      });
      setProgress(80);
      setStage("analyzing");
      toast.info("Analyzing contract with AI…");
      try {
        await analyzeContract(token, contract.id, ruleIds);
        setProgress(100);
        setStage("done");
        toast.success("Contract uploaded and analyzed!");
      } catch {
        toast.success("Contract uploaded! Click 'Analyze' on the contract page to run AI review.");
      }
      router.push(`/contracts/${contract.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setStage("idle");
      setProgress(0);
    }
  };

  const isProcessing = stage === "uploading" || stage === "analyzing";
  const canGoToStep2 = !!file && !!selectedClientId && clients.length > 0;
  const canSubmit = !!file && !!selectedClientId && !isProcessing;
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const stepLabels = ["Document", "Details", "Review Settings"];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-8 pt-5 pb-4 border-b bg-white flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">New Contract Request</h1>
          <p className="text-xs text-gray-400 mt-0.5">Create a full contract record with metadata, dates, and AI review.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/clients">
            <Building2 className="h-4 w-4 mr-1.5" />
            Manage Clients
          </Link>
        </Button>
      </div>

      {/* Step indicators */}
      <div className="shrink-0 px-8 py-3 border-b bg-gray-50/60 flex items-center gap-0">
        {stepLabels.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const isActive = step === n;
          const isDone = step > n;
          return (
            <div key={n} className="flex items-center">
              <button
                type="button"
                disabled={n > 1 && !canGoToStep2}
                onClick={() => { if (n === 1 || canGoToStep2) setStep(n); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  isActive ? "bg-primary text-white" :
                  isDone   ? "text-primary hover:bg-primary/10 cursor-pointer" :
                             "text-gray-400 cursor-default",
                )}
              >
                <span className={cn(
                  "h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold",
                  isActive ? "bg-white/30 text-white" :
                  isDone   ? "bg-primary/15 text-primary" :
                             "bg-gray-200 text-gray-500",
                )}>
                  {isDone ? "✓" : n}
                </span>
                {label}
              </button>
              {i < stepLabels.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-2xl mx-auto">

          {/* ─ STEP 1: Document ─ */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
                  Contract File <span className="text-red-500">*</span>
                </Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  className={cn(
                    "flex items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all",
                    dragOver ? "border-primary bg-primary/5 scale-[1.01]" :
                    file      ? "border-emerald-400 bg-emerald-50" :
                               "border-gray-200 hover:border-primary/40 hover:bg-gray-50",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    className="sr-only"
                  />
                  {file ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)} · Ready to upload</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setFile(null); setTitle(""); }}
                        className="shrink-0 rounded-full p-1.5 hover:bg-gray-200 transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center py-4">
                      <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">
                        Drop your file here, or <span className="text-primary underline">browse</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PDF or DOCX · max 10 MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Client / Vendor Account <span className="text-red-500">*</span>
                  </Label>
                  <Link href="/clients" className="text-[11px] text-primary hover:underline">+ New client</Link>
                </div>
                {clients.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3">
                    <Building2 className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">
                      No clients yet.{" "}
                      <Link href="/clients" className="font-semibold underline">Create a client</Link>
                      {" "}before uploading.
                    </p>
                  </div>
                ) : (
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.status === "inactive" && <span className="text-[10px] text-red-500 ml-1">(inactive)</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} disabled={!canGoToStep2} className="gap-1.5">
                  Continue to Details <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─ STEP 2: Contract Details ─ */}
          {step === 2 && (
            <div className="space-y-5">
              {extractingMeta && (
                <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  AI is detecting fields from your contract…
                </div>
              )}
              {!extractingMeta && aiFilledFields.size > 0 && (
                <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                  AI detected {aiFilledFields.size} field{aiFilledFields.size > 1 ? "s" : ""} — review and edit as needed
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <FileText className="h-3 w-3 inline mr-1" />
                    Contract Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. MSA 2026 — Acme Corp"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Building2 className="h-3 w-3 inline mr-1" />
                      Counterparty / Vendor
                    </Label>
                    {aiFilledFields.has("counterparty") && (
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">AI detected</span>
                    )}
                  </div>
                  <Input
                    placeholder="e.g. Acme Corporation Inc."
                    value={counterparty}
                    onChange={e => { setCounterparty(e.target.value); setAiFilledFields(s => { const n = new Set(s); n.delete("counterparty"); return n; }); }}
                    className={cn("h-10", aiFilledFields.has("counterparty") && "border-purple-300 bg-purple-50/40")}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contract Type</Label>
                    {aiFilledFields.has("contractType") && (
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">AI detected</span>
                    )}
                  </div>
                  <Select value={contractType} onValueChange={v => { setContractType(v as ContractType); setAiFilledFields(s => { const n = new Set(s); n.delete("contractType"); return n; }); }}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map(t => (
                        <SelectItem key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contract Status</Label>
                  <Select value={contractStatus} onValueChange={setContractStatus}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Calendar className="h-3 w-3 inline mr-1" />Start Date
                    </Label>
                    {aiFilledFields.has("startDate") && (
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">AI detected</span>
                    )}
                  </div>
                  <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setAiFilledFields(s => { const n = new Set(s); n.delete("startDate"); return n; }); }} className={cn("h-10", aiFilledFields.has("startDate") && "border-purple-300 bg-purple-50/40")} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Calendar className="h-3 w-3 inline mr-1" />End / Expiry Date
                    </Label>
                    {aiFilledFields.has("endDate") && (
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">AI detected</span>
                    )}
                  </div>
                  <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setAiFilledFields(s => { const n = new Set(s); n.delete("endDate"); return n; }); }} className={cn("h-10", aiFilledFields.has("endDate") && "border-purple-300 bg-purple-50/40")} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <Calendar className="h-3 w-3 inline mr-1" />Renewal Date
                  </Label>
                  <Input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="h-10" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Globe className="h-3 w-3 inline mr-1" />Governing Law
                    </Label>
                    {aiFilledFields.has("governingLaw") && (
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">AI detected</span>
                    )}
                  </div>
                  <Select value={governingLaw} onValueChange={v => { setGoverningLaw(v); setAiFilledFields(s => { const n = new Set(s); n.delete("governingLaw"); return n; }); }}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {JURISDICTION_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <User className="h-3 w-3 inline mr-1" />Contract Owner
                  </Label>
                  <Input
                    placeholder="e.g. Jane Smith / Legal Team"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <DollarSign className="h-3 w-3 inline mr-1" />Contract Value (USD)
                    </Label>
                    {aiFilledFields.has("contractValue") && (
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 rounded px-1.5 py-0.5">AI detected</span>
                    )}
                  </div>
                  <Input
                    type="number"
                    placeholder="e.g. 500000"
                    value={contractValue}
                    onChange={e => { setContractValue(e.target.value); setAiFilledFields(s => { const n = new Set(s); n.delete("contractValue"); return n; }); }}
                    className="h-10"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" />Back
                </Button>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="font-medium text-gray-600 truncate max-w-[140px]">{file?.name}</span>
                  {selectedClient && <><span>→</span><span>{selectedClient.name}</span></>}
                </div>
                <Button onClick={() => setStep(3)} className="gap-1.5">
                  Review Settings <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─ STEP 3: Playbook + Submit ─ */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="rounded-xl border bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contract Record</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <p className="text-[11px] text-gray-400">Title</p>
                    <p className="font-medium text-gray-900 truncate">{title || file?.name?.replace(/\.[^.]+$/, "") || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Counterparty</p>
                    <p className="font-medium text-gray-900 truncate">{counterparty || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Type</p>
                    <p className="font-medium text-gray-900">{CONTRACT_TYPE_LABELS[contractType]}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Client</p>
                    <p className="font-medium text-gray-900 truncate">{selectedClient?.name ?? "—"}</p>
                  </div>
                  {endDate && (
                    <div>
                      <p className="text-[11px] text-gray-400">End Date</p>
                      <p className="font-medium text-gray-900">{endDate}</p>
                    </div>
                  )}
                  {renewalDate && (
                    <div>
                      <p className="text-[11px] text-gray-400">Renewal Date</p>
                      <p className="font-medium text-gray-900">{renewalDate}</p>
                    </div>
                  )}
                  {ownerName && (
                    <div>
                      <p className="text-[11px] text-gray-400">Owner</p>
                      <p className="font-medium text-gray-900 truncate">{ownerName}</p>
                    </div>
                  )}
                  {contractValue && (
                    <div>
                      <p className="text-[11px] text-gray-400">Value</p>
                      <p className="font-medium text-gray-900">${Number(contractValue).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Playbook */}
              <div className="rounded-xl border bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">Playbook</span>
                    {playbookEnabled && selectedRuleIds.length > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                        {selectedRuleIds.length} active
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlaybookEnabled(p => !p)}
                    disabled={isProcessing}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                      playbookEnabled ? "bg-primary" : "bg-gray-300",
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform translate-x-0.5",
                      playbookEnabled && "translate-x-[18px]",
                    )} />
                  </button>
                </div>
                <div className="p-3 max-h-52 overflow-y-auto">
                  {!playbookEnabled ? (
                    <p className="text-xs text-gray-400 text-center py-3">
                      Standard review — AI uses market norms without a custom playbook.
                    </p>
                  ) : rulesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : rules.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                      <Gavel className="h-6 w-6 text-gray-200" />
                      <p className="text-xs text-gray-500 font-medium">No active playbooks</p>
                      <Link href="/rules" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                        Upload playbooks <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <button type="button" onClick={toggleSelectAll} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left">
                        {selectedRuleIds.length === rules.length
                          ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                          : <Square className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          {selectedRuleIds.length === rules.length ? "Deselect all" : "Select all"}
                        </span>
                      </button>
                      <div className="border-t my-1" />
                      {rules.map(rule => (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => toggleRule(rule.id)}
                          disabled={isProcessing}
                          className={cn(
                            "w-full flex items-start gap-2.5 px-2 py-2 rounded-md transition-colors text-left",
                            selectedRuleIds.includes(rule.id) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-gray-50",
                          )}
                        >
                          {selectedRuleIds.includes(rule.id)
                            ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            : <Square className="h-3.5 w-3.5 text-gray-300 shrink-0 mt-0.5" />}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800 leading-snug truncate">{rule.name}</p>
                            {(rule.original_filename || rule.description) && (
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                {rule.original_filename ?? rule.description}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-1.5">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-gray-500 text-center">
                    {stage === "uploading" ? "Uploading file…" : "AI is analyzing your contract…"}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(2)} disabled={isProcessing} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" />Back
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit} size="lg" className="gap-1.5">
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{stage === "uploading" ? "Uploading…" : "Analyzing…"}</>
                  ) : (
                    <><Upload className="h-4 w-4" />Upload &amp; Analyze</>
                  )}
                </Button>
              </div>

              <p className="text-[11px] text-gray-400 text-center">
                AI-generated insights are for informational purposes only and do not constitute legal advice.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
