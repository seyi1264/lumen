import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame } from "@/components/studio/chart-frame";
import { Kpi } from "@/components/studio/kpi";
import { PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PLATFORM_META } from "@/lib/studio/constants";
import { formatNumber } from "@/lib/studio/format";
import {
  kpis,
  pillarPerformance,
  platformPerformance,
  topPosts,
} from "@/lib/studio/insights";
import { engagementRate } from "@/lib/studio/score";
import { useStudioStore } from "@/lib/studio/store";

export const Route = createFileRoute("/_app/monitor")({
  component: MonitorPage,
});

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-md bg-surface px-3 py-2 text-xs shadow-[var(--shadow-border)]">
      <p className="text-muted">{format(parseISO(label), "MMM d")}</p>
      {payload.map((p) => (
        <p key={p.name} className="tabular text-fg">
          {p.name} {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
}

function MonitorPage() {
  const posts = useStudioStore((s) => s.posts);
  const deals = useStudioStore((s) => s.deals);
  const stats = useStudioStore((s) => s.stats);
  const pulse = kpis(posts, deals, stats);
  const series = stats.slice(-28).map((s) => ({
    ...s,
    date: s.date,
  }));
  const platforms = platformPerformance(posts);
  const pillars = pillarPerformance(posts);
  const top = topPosts(posts, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Monitor"
        title="The pulse"
        description="What landed, what saved, and which rooms are actually listening. Ignore vanity that does not move the letter."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Impressions · 7d" value={formatNumber(pulse.impressions.last)} delta={pulse.impressions.delta} />
        <Kpi label="Engagement · 7d" value={formatNumber(pulse.engagement.last)} delta={pulse.engagement.delta} />
        <Kpi label="Audience" value={formatNumber(pulse.followersNow)} delta={pulse.followerDelta} />
        <Kpi label="Avg. rate" value={`${pulse.avgRate.toFixed(1)}%`} hint="engagement / impressions" />
      </section>

      <Card className="lumen-enter mt-6">
        <h2 className="font-display text-2xl">Twenty-eight days</h2>
        <p className="mt-1 text-sm text-muted">Impressions as the wash, engagement as the line that matters.</p>
        <div className="mt-4">
          <ChartFrame height={240}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="imp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(parseISO(v), "d")}
                tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<Tip />} />
              <Area
                type="monotone"
                dataKey="impressions"
                name="Impressions"
                stroke="var(--color-muted)"
                fill="url(#imp)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="engagement"
                name="Engagement"
                stroke="var(--color-primary)"
                fill="none"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartFrame>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl">Rooms</h2>
          <div className="mt-4">
            <ChartFrame height={200}>
              <BarChart data={platforms} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="platform"
                  tickFormatter={(v) => PLATFORM_META[v as keyof typeof PLATFORM_META].short}
                  tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<Tip />} />
                <Bar dataKey="impressions" name="Impressions" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartFrame>
          </div>
          <ul className="mt-2 space-y-2">
            {platforms.map((p) => (
              <li key={p.platform} className="flex items-center justify-between text-sm">
                <span className="text-muted">{PLATFORM_META[p.platform].label}</span>
                <span className="tabular text-fg">
                  {formatNumber(p.impressions)} · {p.rate.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-display text-2xl">Pillars</h2>
          <ul className="mt-4 space-y-4">
            {pillars.map((p) => (
              <li key={p.pillar}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-fg">{p.pillar}</span>
                  <span className="tabular text-muted">
                    {p.rate.toFixed(1)}% · {p.n}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, p.rate * 8)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-2xl">Work that carried</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-subtle uppercase">
              <tr className="border-b border-border/80">
                <th className="py-2 pr-3 font-medium">Piece</th>
                <th className="py-2 pr-3 font-medium">Room</th>
                <th className="py-2 pr-3 font-medium">Reach</th>
                <th className="py-2 pr-3 font-medium">Eng</th>
                <th className="py-2 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-3">
                    <Link to="/create" search={{ id: p.id }} className="text-fg hover:underline">
                      {p.title}
                    </Link>
                    <div className="mt-1">
                      <Badge tone="muted">{p.pillar}</Badge>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-muted">{PLATFORM_META[p.platform].label}</td>
                  <td className="py-3 pr-3 tabular">{formatNumber(p.metrics?.impressions ?? 0)}</td>
                  <td className="py-3 pr-3 tabular">{formatNumber(p.metrics?.engagement ?? 0)}</td>
                  <td className="py-3 tabular text-gain">{engagementRate(p.metrics).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
