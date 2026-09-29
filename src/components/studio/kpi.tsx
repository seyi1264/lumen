import { formatDelta } from "@/lib/studio/insights";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  delta,
  hint,
  className,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]", className)}>
      <p className="text-xs font-medium tracking-wide text-muted">{label}</p>
      <p className="mt-3 font-display text-3xl tracking-tight tabular text-fg">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {typeof delta === "number" && (
          <span className={cn("tabular", delta >= 0 ? "text-gain" : "text-loss")}>
            {formatDelta(delta)}
          </span>
        )}
        {hint && <span className="text-subtle">{hint}</span>}
      </div>
    </div>
  );
}
