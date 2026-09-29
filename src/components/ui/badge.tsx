import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      tone: {
        muted: "bg-raised text-muted",
        paper: "bg-primary/10 text-fg",
        gain: "bg-gain/15 text-gain",
        loss: "bg-loss/15 text-loss",
        draft: "bg-raised text-muted",
        scheduled: "bg-primary/12 text-fg",
        published: "bg-gain/15 text-gain",
        archived: "bg-raised text-subtle",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
