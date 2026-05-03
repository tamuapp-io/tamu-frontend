import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiStatProps {
  label: string;
  value: string | number;
  delta?: { direction: "up" | "down" | "flat"; label: string };
  description?: string;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
}

export function KpiStat({
  label,
  value,
  delta,
  description,
  icon: Icon,
  loading,
  className,
}: KpiStatProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="label-cap">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
        ) : (
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
        )}
        {delta && !loading && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
              delta.direction === "up" &&
                "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
              delta.direction === "down" &&
                "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
              delta.direction === "flat" &&
                "bg-muted text-muted-foreground",
            )}
          >
            {delta.label}
          </span>
        )}
      </div>

      {description && !loading && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
