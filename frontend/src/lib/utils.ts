import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ContractType, RiskLevel, ContractStatus } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  nda: "NDA",
  msa: "MSA",
  saas: "SaaS Agreement",
  sow: "Statement of Work",
  order_form: "Order Form",
  employment: "Employment Agreement",
  vendor_agreement: "Vendor Agreement",
  other: "Other",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
  critical: "Critical Risk",
};

export const STATUS_LABELS: Record<ContractStatus, string> = {
  uploaded: "Uploaded",
  processing: "Analyzing…",
  analyzed: "Analyzed",
  failed: "Failed",
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

export const STATUS_COLORS: Record<ContractStatus, string> = {
  uploaded: "bg-blue-100 text-blue-700 border-blue-200",
  processing: "bg-violet-100 text-violet-700 border-violet-200",
  analyzed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

export const CONTRACT_BUSINESS_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  in_negotiation: "In Negotiation",
  pending_approval: "Pending Approval",
  executed: "Executed",
  expired: "Expired",
  on_hold: "On Hold",
  terminated: "Terminated",
};

export type LifecycleBadge = {
  label: string;
  className: string;
  type: "active" | "expired" | "renewal_due" | "neutral";
};

export function getLifecycleBadge(contract: {
  end_date?: string | null;
  renewal_date?: string | null;
  contract_status?: string | null;
}): LifecycleBadge {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (contract.end_date) {
    const ed = new Date(contract.end_date);
    if (ed < today) {
      return { label: "Expired", className: "bg-red-100 text-red-700 border border-red-200", type: "expired" };
    }
  }

  if (contract.renewal_date) {
    const rd = new Date(contract.renewal_date);
    const daysUntil = Math.ceil((rd.getTime() - today.getTime()) / 86400000);
    if (daysUntil >= 0 && daysUntil <= 90) {
      return {
        label: daysUntil === 0 ? "Renewal Today" : `Renewal in ${daysUntil}d`,
        className: "bg-amber-100 text-amber-700 border border-amber-200",
        type: "renewal_due",
      };
    }
  }

  if (contract.contract_status === "executed") {
    return { label: "Active", className: "bg-emerald-100 text-emerald-700 border border-emerald-200", type: "active" };
  }

  const label = CONTRACT_BUSINESS_STATUS_LABELS[contract.contract_status ?? "draft"] ?? "Draft";
  return { label, className: "bg-gray-100 text-gray-600 border border-gray-200", type: "neutral" };
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}
