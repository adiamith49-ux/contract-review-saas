"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, FileDown, FileText, Loader2, AlertTriangle, FileSignature, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { getContract, downloadExport, type ContractDetail } from "@/lib/api";
import { formatDate, CONTRACT_TYPE_LABELS } from "@/lib/utils";

type DownloadKind = "pdf" | "docx" | "original";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<DownloadKind | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const { contract } = await getContract(token, id);
        setContract(contract);
      } catch {
        toast.error("Failed to load contract");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleReviewDownload(format: "pdf" | "docx") {
    if (!contract) return;
    setDownloading(format);
    try {
      const token = await getToken();
      await downloadExport(token, id, format, contract.filename, undefined, contract.version_number);
      toast.success(format === "pdf" ? "Risk report downloaded" : "Reviewed Word document downloaded");
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setDownloading(null);
    }
  }

  function handleOriginalDownload() {
    if (!contract?.fileUrl) {
      toast.error("Original file is unavailable");
      return;
    }
    setDownloading("original");
    // Pre-signed S3 URL — open to download the untouched original upload
    window.open(contract.fileUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => setDownloading(null), 1200);
  }

  const analysis = contract?.analyses?.[0];
  const version = contract?.version_number ?? 1;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href={`/contracts/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Contract
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Export & Download</h1>
        <p className="text-gray-500 mt-1">Download the risk report, the reviewed Word document, or the original file.</p>
      </div>

      {loading ? (
        <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
      ) : !contract ? (
        <div className="text-center py-12 text-gray-400">Contract not found</div>
      ) : (
        <div className="space-y-4">
          {/* Contract info */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{contract.title || contract.filename}</p>
                  {version > 1 && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">v{version}</span>}
                </div>
                <p className="text-xs text-gray-500">{CONTRACT_TYPE_LABELS[contract.contract_type]} · {formatDate(contract.created_at)}</p>
              </div>
              {analysis && <RiskBadge level={analysis.risk_level} />}
            </CardContent>
          </Card>

          {/* Review exports (require analysis) */}
          <Card>
            <CardHeader>
              <CardTitle>Review Exports</CardTitle>
              <CardDescription>
                {analysis
                  ? "Generated from this contract's AI analysis — findings match what you see in the review panel."
                  : "Run the AI analysis first to enable the risk report and reviewed Word document."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ExportButton
                onClick={() => handleReviewDownload("pdf")}
                disabled={!!downloading || !analysis}
                busy={downloading === "pdf"}
                iconBg="bg-red-100" iconColor="text-red-600" icon={<FileDown className="h-5 w-5" />}
                title="PDF Risk Report"
                subtitle="Risk summary, clause findings & suggested language — best for sharing"
              />
              <ExportButton
                onClick={() => handleReviewDownload("docx")}
                disabled={!!downloading || !analysis}
                busy={downloading === "docx"}
                iconBg="bg-blue-100" iconColor="text-blue-600" icon={<FileSignature className="h-5 w-5" />}
                title="Word — Reviewed Contract"
                subtitle="Full contract with Word comments + tracked-change redlines, ready for counterparty markup"
              />
            </CardContent>
          </Card>

          {/* Original file */}
          <Card>
            <CardHeader>
              <CardTitle>Source File</CardTitle>
              <CardDescription>The untouched document exactly as uploaded.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExportButton
                onClick={handleOriginalDownload}
                disabled={!!downloading || !contract.fileUrl}
                busy={downloading === "original"}
                iconBg="bg-gray-100" iconColor="text-gray-600" icon={<Download className="h-5 w-5" />}
                title="Download Original Contract"
                subtitle={contract.filename}
              />
            </CardContent>
          </Card>

          {!analysis && (
            <div className="flex items-center gap-2 text-xs text-amber-600 justify-center">
              <AlertTriangle className="h-3.5 w-3.5" />
              Review exports unlock after you run the AI analysis.
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            AI-generated insights are not legal advice. Always consult a qualified lawyer.
          </p>
        </div>
      )}
    </div>
  );
}

function ExportButton({
  onClick, disabled, busy, iconBg, iconColor, icon, title, subtitle,
}: {
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-4 rounded-lg border p-4 text-left hover:bg-gray-50 hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
    </button>
  );
}
