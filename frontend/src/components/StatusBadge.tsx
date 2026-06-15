import type { ContractStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const config: Record<ContractStatus, { bg: string; text: string; dot: string; label: string; pulse?: boolean }> = {
  uploaded:   { bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500",    label: "Uploaded"  },
  processing: { bg: "bg-violet-100", text: "text-violet-800", dot: "bg-violet-500",  label: "Analyzing", pulse: true },
  analyzed:   { bg: "bg-emerald-100",text: "text-emerald-800",dot: "bg-emerald-500", label: "Analyzed"  },
  failed:     { bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500",     label: "Failed"    },
};

interface StatusBadgeProps {
  status: ContractStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { bg, text, dot, label, pulse } = config[status] ?? config.uploaded;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
      bg, text, className,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot, pulse && "animate-pulse")} />
      {label}
    </span>
  );
}
