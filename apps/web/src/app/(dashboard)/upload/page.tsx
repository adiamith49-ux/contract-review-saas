"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ContractType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { uploadContract, analyzeContract } from "@/lib/api";
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
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;

    try {
      const token = await getToken();

      // Stage 1: upload
      setStage("uploading");
      setProgress(30);
      const { contract } = await uploadContract(token, file, contractType);
      setProgress(60);

      // Stage 2: analyze (auto-triggered)
      setStage("analyzing");
      toast.info("Analyzing contract with AI…");
      await analyzeContract(token, contract.id);
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

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Contract</h1>
        <p className="text-gray-500 mt-1">Upload a PDF or DOCX contract to get an AI-powered review.</p>
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
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50",
              isProcessing && "pointer-events-none opacity-60"
            )}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" onChange={onInputChange} className="sr-only" />
            {file ? (
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                {!isProcessing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
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
              onValueChange={(v) => setContractType(v as ContractType)}
              disabled={isProcessing}
            >
              <SelectTrigger id="contract-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {CONTRACT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress bar */}
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
