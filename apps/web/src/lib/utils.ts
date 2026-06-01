import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ContractType, RiskLevel, ContractStatus } from "@contralyn/shared";

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
