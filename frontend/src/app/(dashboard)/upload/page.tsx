"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Upload, FileText, X, Loader2, ShieldCheck, CheckSquare, Square, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { ContractType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [contractType, setContractType] = useState<ContractType>("other");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);

  // Playbook state
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [playbookEnabled, setPlaybookEnabled] = useState(true);

  // Load user's active review rules
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

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;

    // Determine which rule IDs to send to the analysis
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
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setStage("idle");
      setProgress(0);
    }
  };

  const isProcessing = stage === "uploading" || stage === "analyzing";

  const ruleCountLabel = () => {
    if (!playbookEnabled) return "Standard review (no custom rules)";
    if (rules.length === 0) return "No rules configured";
    if (selectedRuleIds.length === 0) return "No rules selected — standard review will be used";
    if (selectedRuleIds.length === rules.length) return `All ${rules.length} rule${rules.length > 1 ? "s" : ""} applied`;
    return `${selectedRuleIds.length} of ${rules.length} rules applied`;
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Contract</h1>
        <p className="text-gray-500 mt-1">Upload a PDF or DOCX contract for AI-powered review.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select File</CardTitle>
          <CardDescription>PDF or DOCX · max 10 MB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dropzone */}
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50",
              isProcessing && "pointer-events-none opacity-60",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={onInputChange}
              className="sr-only"
            />
            {file ? (
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                {!isProcessing && (
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="ml-2 rounded-full p-1 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">Drop your file here, or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX up to 10 MB</p>
              </>
            )}
          </div>

          {/* Contract type */}
          <div className="space-y-2">
            <Label htmlFor="contract-type">Contract Type</Label>
            <Select
              value={contractType}
              onValueChange={v => setContractType(v as ContractType)}
              disabled={isProcessing}
            >
              <SelectTrigger id="contract-type">
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

          <Separator />

          {/* Playbook / Review Rules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Playbook / Review Rules</Label>
              </div>
              <button
                type="button"
                onClick={() => setPlaybookEnabled(p => !p)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
              >
                {playbookEnabled
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : <Square className="h-4 w-4" />}
                Apply rules
              </button>
            </div>

            <p className="text-xs text-gray-500">
              {ruleCountLabel()}
            </p>

            {playbookEnabled && (
              rulesLoading ? (
                <p className="text-xs text-gray-400 italic">Loading rules…</p>
              ) : rules.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-500">No active review rules found.</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    AI will use standard market norms for this review.
                  </p>
                  <Link
                    href="/rules"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline font-medium"
                  >
                    Upload playbooks <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  {/* Select all header */}
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    disabled={isProcessing}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 border-b hover:bg-gray-100 transition-colors text-left"
                  >
                    {selectedRuleIds.length === rules.length
                      ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                      : <Square className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                    <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      {selectedRuleIds.length === rules.length ? "Deselect all" : "Select all"}
                    </span>
                  </button>

                  {/* Individual rules */}
                  {rules.map(rule => (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      disabled={isProcessing}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-3 py-2.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors text-left",
                        selectedRuleIds.includes(rule.id) ? "bg-primary/3" : "bg-white",
                      )}
                    >
                      {selectedRuleIds.includes(rule.id)
                        ? <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        : <Square className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">{rule.name}</p>
                        {rule.original_filename ? (
                          <p className="text-[11px] text-gray-400 truncate">{rule.original_filename}</p>
                        ) : rule.description ? (
                          <p className="text-[11px] text-gray-500 truncate">{rule.description}</p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {!playbookEnabled && (
              <p className="text-xs text-gray-400 italic">
                AI will review against standard market norms without custom playbook rules.
              </p>
            )}
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-500 text-center">
                {stage === "uploading" ? "Uploading file…" : "AI is analyzing your contract…"}
              </p>
            </div>
          )}

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={!file || isProcessing} className="w-full">
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {stage === "uploading" ? "Uploading…" : "Analyzing…"}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Analyze
              </>
            )}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            AI-generated insights are not legal advice.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
