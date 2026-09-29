import { cn } from "@/lib/utils";

export function LumenMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-fg", className)}
      aria-hidden
      fill="none"
    >
      <rect
        x="5.5"
        y="4.5"
        width="21"
        height="23"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="15" y="8" width="2" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

export function LumenWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LumenMark className="size-6" />
      <span className="font-display text-xl tracking-tight">Lumen</span>
    </span>
  );
}
