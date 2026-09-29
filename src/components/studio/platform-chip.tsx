import { PLATFORM_META } from "@/lib/studio/constants";
import type { Platform } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function PlatformChip({
  platform,
  active,
  onClick,
  className,
}: {
  platform: Platform;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const meta = PLATFORM_META[platform];
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-full px-3 text-xs font-medium tracking-wide transition-[background-color,color] duration-150",
        active ? "bg-primary text-primary-fg" : "bg-raised text-muted hover:text-fg",
        onClick && "min-w-11",
        className,
      )}
    >
      {meta.label}
    </Comp>
  );
}

export function PlatformMark({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-sm bg-raised text-[0.65rem] font-medium tracking-wider text-muted">
      {PLATFORM_META[platform].short}
    </span>
  );
}
