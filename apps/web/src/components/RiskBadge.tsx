import type { RiskLevel } from "@contralyn/shared";
import { cn, RISK_LEVEL_LABELS, RISK_COLORS } from "@/lib/utils";

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", RISK_COLORS[level], className)}>
      {RISK_LEVEL_LABELS[level]}
    </span>
  );
}
