"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, FileDown, FileText, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { getContract, downloadExport, type ContractDetail } from "@/lib/api";
import { formatDate, CONTRACT_TYPE_LABELS } from "@/lib/utils";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

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

  async function handleDownload(format: "pdf" | "docx") {
    if (!contract) return;
    setDownloading(format);
    try {
      const token = await getToken();
      await downloadExport(token, id, format, contract.filename);
      toast.success(`Downloaded ${contract.filename.replace(/\.[^.]+$/, "")}-review.${format}`);
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setDownloading(null);
    }
  }

  const analysis = contract?.analyses?.[0];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href={`/contracts/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Contract
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Export Report</h1>
        <p className="text-gray-500 mt-1">Download the AI-reviewed contract with inline annotations.</p>
      </div>

      {loading ? (
        <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
      ) : !contract ? (
        <div className="text-center py-12 text-gray-400">Contract not found</div>
      ) : !analysis ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="font-medium text-gray-700">No analysis available</p>
            <p className="text-sm text-gray-400">Run the AI analysis first before exporting.</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={`/contracts/${id}`}>Go to Analysis</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Contract info */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{contract.filename}</p>
                <p className="text-xs text-gray-500">{CONTRACT_TYPE_LABELS[contract.contract_type]} · {formatDate(contract.created_at)}</p>
              </div>
              <RiskBadge level={analysis.risk_level} />
            </CardContent>
          </Card>

          {/* Download options */}
          <Card>
            <CardHeader>
              <CardTitle>Download Format</CardTitle>
              <CardDescription>The exported file contains all AI findings and negotiation suggestions as inline annotations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => handleDownload("pdf")}
                disabled={!!downloading}
                className="w-full flex items-center gap-4 rounded-lg border p-4 text-left hover:bg-gray-50 hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 shrink-0">
                  <FileDown className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Download as PDF</p>
                  <p className="text-xs text-gray-500">Best for reading and sharing</p>
                </div>
                {downloading === "pdf" && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </button>

              <button
                onClick={() => handleDownload("docx")}
                disabled={!!downloading}
                className="w-full flex items-center gap-4 rounded-lg border p-4 text-left hover:bg-gray-50 hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                  <FileDown className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Download as DOCX</p>
                  <p className="text-xs text-gray-500">Best for further editing in Word</p>
                </div>
                {downloading === "docx" && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </button>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-400 text-center">
            AI-generated insights are not legal advice. Always consult a qualified lawyer.
          </p>
        </div>
      )}
    </div>
  );
}
