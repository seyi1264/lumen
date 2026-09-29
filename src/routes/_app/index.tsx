import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Kpi } from "@/components/studio/kpi";
import { PageHeader } from "@/components/studio/page-header";
import { PostRow } from "@/components/studio/post-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/studio/format";
import { kpis, overviewInsights, upcoming } from "@/lib/studio/insights";
import { useStudioStore } from "@/lib/studio/store";

function hello(name: string) {
  const h = new Date().getHours();
  const when = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${when}, ${name}.`;
}

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
});

function OverviewPage() {
  const posts = useStudioStore((s) => s.posts);
  const deals = useStudioStore((s) => s.deals);
  const stats = useStudioStore((s) => s.stats);
  const voice = useStudioStore((s) => s.voice);
  const pulse = kpis(posts, deals, stats);
  const insights = overviewInsights(posts, deals, stats);
  const next = upcoming(posts, 4);
  const recent = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={hello(voice.name.split(" ")[0] ?? "there")}
        description="The desk is set. One letter, two notes, and a rate sitting in the pipeline. Do the next honest thing."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/autopilot">Autopilot</Link>
            </Button>
            <Button asChild>
              <Link to="/create">New piece</Link>
            </Button>
          </div>
        }
      />

      <section className="lumen-enter grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Impressions · 7d"
          value={formatNumber(pulse.impressions.last)}
          delta={pulse.impressions.delta}
          hint="across rooms"
        />
        <Kpi
          label="Engagement · 7d"
          value={formatNumber(pulse.engagement.last)}
          delta={pulse.engagement.delta}
          hint={`${pulse.avgRate.toFixed(1)}% average`}
        />
        <Kpi
          label="Audience"
          value={formatNumber(pulse.followersNow)}
          delta={pulse.followerDelta}
          hint="all platforms"
        />
        <Kpi
          label="Collected"
          value={formatCurrency(pulse.paid)}
          hint={`${formatCurrency(pulse.open)} open`}
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-5">
        <Card className="lumen-enter lumen-enter-2 lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl">What the room is saying</h2>
            <Link to="/grow" className="text-xs text-muted hover:text-fg">
              Full brief
            </Link>
          </div>
          <ul className="divide-y divide-border/80">
            {insights.map((item) => (
              <li key={item.title} className="py-4 first:pt-0 last:pb-0">
                <p className="text-[0.65rem] font-medium tracking-[0.16em] text-subtle uppercase">
                  {item.kicker}
                </p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-fg">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                  {item.to && (
                    <Link
                      to={item.to}
                      search={item.search as never}
                      className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-fg"
                      aria-label={item.title}
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="lumen-enter lumen-enter-3">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-2xl">On the calendar</h2>
              <Link to="/calendar" className="text-xs text-muted hover:text-fg">
                Open
              </Link>
            </div>
            {next.length === 0 ? (
              <p className="text-sm text-muted">Nothing scheduled. Place one piece this week.</p>
            ) : (
              <div className="-mx-2">
                {next.map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </div>
            )}
          </Card>
          <Card className="lumen-enter lumen-enter-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-2xl">Already out</h2>
              <Link to="/monitor" className="text-xs text-muted hover:text-fg">
                Pulse
              </Link>
            </div>
            <div className="-mx-2">
              {recent.map((p) => (
                <PostRow key={p.id} post={p} />
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
