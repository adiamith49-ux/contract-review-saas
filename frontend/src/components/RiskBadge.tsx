import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const config: Record<RiskLevel, { bg: string; text: string; dot: string; label: string }> = {
  low:      { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500", label: "Low"      },
  medium:   { bg: "bg-amber-100",   text: "text-amber-800",   dot: "bg-amber-500",   label: "Medium"   },
  high:     { bg: "bg-orange-100",  text: "text-orange-800",  dot: "bg-orange-500",  label: "High"     },
  critical: { bg: "bg-red-100",     text: "text-red-800",     dot: "bg-red-500",     label: "Critical" },
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const { bg, text, dot, label } = config[level] ?? config.low;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
      bg, text, className,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} />
      {label}
    </span>
  );
}
