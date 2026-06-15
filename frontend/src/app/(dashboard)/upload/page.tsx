"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Upload, FileText, X, Loader2, ShieldCheck, CheckSquare, Square,
  ExternalLink, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { ContractType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { uploadContract, analyzeContract, listRules, type ReviewRule } from "@/lib/api";
import { formatFileSize, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

type Stage = "idle" | "uploading" | "analyzing" | "done";

export default function UploadPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile]               = useState<File | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const [contractType, setContractType] = useState<ContractType>("other");
  const [stage, setStage]             = useState<Stage>("idle");
  const [progress, setProgress]       = useState(0);

  const [rules, setRules]                   = useState<ReviewRule[]>([]);
  const [rulesLoading, setRulesLoading]     = useState(true);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [playbookEnabled, setPlaybookEnabled] = useState(true);

  useEffect(() => {
    getToken()
      .then(token => listRules(token))
      .then(({ rules: r }) => {
        const active = r.filter(rule => rule.is_active);
        setRules(active);
        setSelectedRuleIds(active.map(rule => rule.id));
      })
      .catch(() => {})
      .finally(() => setRulesLoading(false));
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
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!file) return;
    const ruleIds = playbookEnabled ? selectedRuleIds : [];
    try {
      const token = await getToken();
      setStage("uploading");
      setProgress(30);
      const { contract } = await uploadContract(token, file, contractType);
      setProgress(60);
      setStage("analyzing");
      toast.info("Analyzing contract with AI…");
      await analyzeContract(token, contract.id, ruleIds);
      setProgress(100);
      setStage("done");
      toast.success("Analysis complete!");
      router.push(`/contracts/${contract.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setStage("idle");
      setProgress(0);
    }
  };

  const isProcessing = stage === "uploading" || stage === "analyzing";

  const activeCount = selectedRuleIds.length;

  return (
    <div className="h-full flex flex-col">
      {/* ── Compact header ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 pt-6 pb-4 border-b bg-white">
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Upload Contract</h1>
        <p className="text-xs text-gray-400 mt-0.5">Upload a PDF or DOCX for AI-powered risk review and negotiation guidance.</p>
      </div>

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── Left: File + type + submit (3 cols) ──────────────────── */}
            <div className="lg:col-span-3 flex flex-col gap-4">

              {/* Dropzone */}
              <div
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={cn(
                  "relative flex items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all",
                  dragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : file
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-gray-200 hover:border-primary/40 hover:bg-gray-50",
                  isProcessing && "pointer-events-none opacity-60",
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
                    {!isProcessing && (
                      <button
                        onClick={e => { e.stopPropagation(); setFile(null); }}
                        className="shrink-0 rounded-full p-1.5 hover:bg-gray-200 transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-gray-500" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                      <Upload className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">Drop your file here, or <span className="text-primary underline">browse</span></p>
                    <p className="text-xs text-gray-400 mt-1">PDF or DOCX · max 10 MB</p>
                  </div>
                )}
              </div>

              {/* Contract type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contract Type</Label>
                <Select
                  value={contractType}
                  onValueChange={v => setContractType(v as ContractType)}
                  disabled={isProcessing}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map(type => (
                      <SelectItem key={type} value={type}>
                        {CONTRACT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!file || isProcessing}
                size="lg"
                className="w-full"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{stage === "uploading" ? "Uploading…" : "Analyzing…"}</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Upload & Analyze</>
                )}
              </Button>

              <p className="text-[11px] text-gray-400 text-center -mt-1">
                AI-generated insights are for informational purposes only and do not constitute legal advice.
              </p>
            </div>

            {/* ── Right: Playbook (2 cols) ──────────────────────────────── */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border bg-white h-full flex flex-col">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">Playbook</span>
                    {playbookEnabled && activeCount > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                        {activeCount} active
                      </span>
                    )}
                  </div>
                  {/* Toggle */}
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

                {/* Panel body */}
                <div className="flex-1 overflow-y-auto p-3">
                  {!playbookEnabled ? (
                    <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                      <p className="text-xs text-gray-400 max-w-[180px]">
                        Standard review — AI uses market norms without a custom playbook.
                      </p>
                    </div>
                  ) : rulesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-6 text-center gap-2">
                      <ShieldCheck className="h-7 w-7 text-gray-200" />
                      <p className="text-xs text-gray-500 font-medium">No active playbooks</p>
                      <p className="text-[11px] text-gray-400 max-w-[180px]">
                        AI will review against standard market norms.
                      </p>
                      <Link
                        href="/rules"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline font-medium"
                      >
                        Upload playbooks <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {/* Select all */}
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        disabled={isProcessing}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                      >
                        {selectedRuleIds.length === rules.length
                          ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                          : <Square className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          {selectedRuleIds.length === rules.length ? "Deselect all" : "Select all"}
                        </span>
                      </button>

                      <div className="border-t my-1" />

                      {/* Individual rules */}
                      {rules.map(rule => (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => toggleRule(rule.id)}
                          disabled={isProcessing}
                          className={cn(
                            "w-full flex items-start gap-2.5 px-2 py-2 rounded-md transition-colors text-left",
                            selectedRuleIds.includes(rule.id)
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-gray-50",
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
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
