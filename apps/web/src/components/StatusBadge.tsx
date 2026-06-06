import type { ContractStatus } from "@/lib/types";
import { cn, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";

interface StatusBadgeProps {
  status: ContractStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_COLORS[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
