import { createFileRoute, Link } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/studio/page-header";
import { PlatformMark } from "@/components/studio/platform-chip";
import { PostRow } from "@/components/studio/post-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLATFORM_META } from "@/lib/studio/constants";
import { formatWhen } from "@/lib/studio/format";
import { cadence } from "@/lib/studio/insights";
import { useStudioStore } from "@/lib/studio/store";
import type { Post } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

function postsOnDay(posts: Post[], day: Date) {
  return posts.filter((p) => {
    const at = p.scheduledAt ?? p.publishedAt;
    if (!at) return false;
    return isSameDay(new Date(at), day);
  });
}

function CalendarPage() {
  const posts = useStudioStore((s) => s.posts);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const { published14 } = cadence(posts);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedPosts = postsOnDay(posts, selected);
  const upcoming = posts
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  const density = posts.filter((p) => {
    const at = p.scheduledAt ?? p.publishedAt;
    if (!at) return false;
    const d = new Date(at);
    return isSameMonth(d, cursor);
  }).length;

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title={format(cursor, "MMMM yyyy")}
        description={`${published14} pieces in the last two weeks. ${density} sit on this month. Aim for a steady drum, not a burst.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight />
            </Button>
            <Button asChild>
              <Link to="/create">Place a piece</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lumen-enter overflow-hidden p-3 md:p-4 lg:col-span-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-medium tracking-[0.14em] text-subtle uppercase">
            {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const items = postsOnDay(posts, day);
              const on = isSameDay(day, selected);
              const muted = !isSameMonth(day, cursor);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={cn(
                    "flex min-h-20 flex-col rounded-md p-1.5 text-left transition-colors duration-150 md:min-h-24",
                    on ? "bg-primary text-primary-fg" : "hover:bg-raised",
                    muted && !on && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs tabular",
                      isToday(day) && !on && "bg-raised text-fg",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {items.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "size-1.5 rounded-full",
                          on ? "bg-primary-fg" : p.status === "published" ? "bg-gain" : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  {items[0] && (
                    <span className={cn("mt-auto hidden truncate text-[0.65rem] md:block", on ? "text-primary-fg/80" : "text-muted")}>
                      {PLATFORM_META[items[0].platform].short} {items[0].title}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="lumen-enter lumen-enter-2">
            <p className="text-xs font-medium tracking-wide text-muted">
              {format(selected, "EEEE d MMMM")}
            </p>
            <div className="mt-3">
              {selectedPosts.length === 0 ? (
                <div>
                  <p className="text-sm text-muted">Nothing placed. A quiet day is a choice — or a gap.</p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to="/create">Write for this day</Link>
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {selectedPosts.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/create"
                        search={{ id: p.id }}
                        className="flex gap-3 rounded-md p-2 hover:bg-raised"
                      >
                        <PlatformMark platform={p.platform} />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-fg">{p.title}</p>
                          <p className="text-xs text-muted">
                            {PLATFORM_META[p.platform].label} · {formatWhen(p.scheduledAt ?? p.publishedAt)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-2xl">Queue</h2>
            <div className="mt-2 -mx-2">
              {upcoming.length === 0 ? (
                <p className="px-2 text-sm text-muted">The queue is empty.</p>
              ) : (
                upcoming.map((p) => <PostRow key={p.id} post={p} />)
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
