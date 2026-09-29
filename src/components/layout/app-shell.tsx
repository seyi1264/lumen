import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  CalendarDays,
  CircleDollarSign,
  LayoutGrid,
  Menu,
  PenLine,
  Radio,
  TrendingUp,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UserButton } from "@/lib/auth/gates";
import { duePosts } from "@/lib/studio/channels";
import { useStudioStore } from "@/lib/studio/store";
import { cn } from "@/lib/utils";
import { LumenWordmark } from "./logo";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/autopilot", label: "Autopilot", icon: Bot },
  { to: "/create", label: "Create", icon: PenLine },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/channels", label: "Channels", icon: Radio },
  { to: "/monitor", label: "Monitor", icon: Activity },
  { to: "/monetize", label: "Monetize", icon: CircleDollarSign },
  { to: "/grow", label: "Grow", icon: TrendingUp },
] as const;

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function NavLink({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: (typeof NAV)[number]["icon"];
  onClick?: () => void;
}) {
  const path = useActivePath();
  const active = to === "/" ? path === "/" : path.startsWith(to);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
        active ? "bg-raised text-fg" : "text-muted hover:bg-raised/60 hover:text-fg",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrate = useStudioStore((s) => s.hydrate);
  const voice = useStudioStore((s) => s.voice);
  const posts = useStudioStore((s) => s.posts);
  const [open, setOpen] = useState(false);
  const path = useActivePath();
  const due = duePosts(posts);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const current = NAV.find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)));

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border/80 bg-bg px-3 py-6 md:flex">
        <Link to="/" className="px-3">
          <LumenWordmark />
        </Link>
        <p className="mt-6 px-3 text-[0.65rem] font-medium tracking-[0.16em] text-subtle uppercase">
          Studio
        </p>
        <nav className="mt-2 flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg">{voice.name}</p>
          <p className="text-xs text-muted">{voice.handle}</p>
        </div>
        <div className="mt-3 border-t border-border/80 px-3 pt-3">
          <UserButton />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-bg/90 px-4 backdrop-blur-sm md:hidden">
        <LumenWordmark />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">{current?.label}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Studio" side="bottom">
          <nav className="flex flex-col gap-1 pb-6">
            {NAV.map((item) => (
              <NavLink key={item.to} {...item} onClick={() => setOpen(false)} />
            ))}
          </nav>
          <div className="border-t border-border/80 pt-4">
            <UserButton />
          </div>
        </SheetContent>
      </Sheet>

      <div className="md:pl-56">
        {due.length > 0 && path !== "/channels" && (
          <div className="border-b border-border/80 bg-surface px-4 py-3 md:px-8">
            <Link to="/channels" className="flex items-center justify-between gap-3 text-sm">
              <span className="text-fg">
                {due.length === 1
                  ? "A piece is due. Open Channels to send it."
                  : `${due.length} pieces are due. Open Channels to send them.`}
              </span>
              <span className="shrink-0 text-xs text-muted">Send</span>
            </Link>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-12">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border/80 bg-bg/95 pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) =>
          ["/", "/autopilot", "/create", "/calendar", "/channels", "/monitor"].includes(n.to),
        ).map((item) => {
          const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 text-[0.65rem] tracking-wide",
                active ? "text-fg" : "text-muted",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          className:
            "!bg-surface !text-fg !border-border !shadow-[var(--shadow-border)]",
        }}
      />
    </div>
  );
}
