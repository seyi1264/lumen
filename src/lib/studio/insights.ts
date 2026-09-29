import { differenceInCalendarDays, parseISO } from "date-fns";
import { PLATFORM_META } from "./constants";
import { formatCurrency, formatNumber } from "./format";
import { engagementRate, scorePost } from "./score";
import type { DailyStat, Deal, Platform, Post } from "./types";
import { PILLARS, type Pillar } from "./types";

export type Insight = {
  kicker: string;
  title: string;
  body: string;
  to?: "/create" | "/calendar" | "/monitor" | "/monetize" | "/grow";
  search?: { id?: string };
};

export function pillarPerformance(posts: Post[]): { pillar: Pillar; rate: number; n: number }[] {
  return PILLARS.map((pillar) => {
    const set = posts.filter((p) => p.pillar === pillar && p.metrics);
    const impressions = set.reduce((a, p) => a + (p.metrics?.impressions ?? 0), 0);
    const engagement = set.reduce((a, p) => a + (p.metrics?.engagement ?? 0), 0);
    return {
      pillar,
      n: set.length,
      rate: impressions ? (engagement / impressions) * 100 : 0,
    };
  }).sort((a, b) => b.rate - a.rate);
}

export function platformPerformance(posts: Post[]) {
  const keys = Object.keys(PLATFORM_META) as Platform[];
  return keys
    .map((platform) => {
      const set = posts.filter((p) => p.platform === platform && p.metrics);
      const impressions = set.reduce((a, p) => a + (p.metrics?.impressions ?? 0), 0);
      const engagement = set.reduce((a, p) => a + (p.metrics?.engagement ?? 0), 0);
      return {
        platform,
        n: set.length,
        impressions,
        engagement,
        rate: impressions ? (engagement / impressions) * 100 : 0,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);
}

export function topPosts(posts: Post[], n = 5) {
  return posts
    .filter((p) => p.metrics)
    .sort((a, b) => (b.metrics?.engagement ?? 0) - (a.metrics?.engagement ?? 0))
    .slice(0, n);
}

export function upcoming(posts: Post[], n = 5) {
  return posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(0, n);
}

export function cadence(posts: Post[], now = new Date()) {
  const last14 = posts.filter((p) => {
    const at = p.publishedAt ?? p.scheduledAt;
    if (!at) return false;
    const days = differenceInCalendarDays(now, parseISO(at));
    return days <= 14 && days >= -7;
  });
  const published14 = posts.filter((p) => {
    if (!p.publishedAt) return false;
    const days = differenceInCalendarDays(now, parseISO(p.publishedAt));
    return days >= 0 && days < 14;
  }).length;
  return { last14: last14.length, published14 };
}

export function revenueTotals(deals: Deal[]) {
  const paid = deals.filter((d) => d.status === "paid").reduce((a, d) => a + d.amount, 0);
  const pipeline = deals.filter((d) => d.status === "pipeline").reduce((a, d) => a + d.amount, 0);
  const active = deals.filter((d) => d.status === "active").reduce((a, d) => a + d.amount, 0);
  return { paid, pipeline, active, open: pipeline + active };
}

export function suggestedRate(avgImpressions: number, rate: number) {
  const rpm = 18 + rate * 2.4;
  const letter = Math.round((avgImpressions / 1000) * rpm);
  return { rpm, letter: Math.max(1800, letter) };
}

export function overviewInsights(
  posts: Post[],
  deals: Deal[],
  stats: DailyStat[],
): Insight[] {
  const pillars = pillarPerformance(posts);
  const best = pillars[0];
  const worst = [...pillars].reverse().find((p) => p.n > 0) ?? pillars[pillars.length - 1];
  const { published14 } = cadence(posts);
  const { open, paid } = revenueTotals(deals);
  const drafts = posts.filter((p) => p.status === "draft");
  const next = upcoming(posts, 1)[0];
  const last7 = stats.slice(-7);
  const prev7 = stats.slice(-14, -7);
  const eng = last7.reduce((a, s) => a + s.engagement, 0);
  const prevEng = prev7.reduce((a, s) => a + s.engagement, 0) || 1;
  const delta = ((eng - prevEng) / prevEng) * 100;

  const items: Insight[] = [];

  if (best && best.n) {
    items.push({
      kicker: "Angle",
      title: `${best.pillar} is carrying the room`,
      body: `Engagement on ${best.pillar.toLowerCase()} sits at ${best.rate.toFixed(1)}%. Lean the next two pieces that way before you chase a new topic.`,
      to: "/create",
    });
  }

  items.push({
    kicker: "Pace",
    title:
      published14 >= 6
        ? "Cadence is healthy"
        : "The calendar is thinning",
    body:
      published14 >= 6
        ? `${published14} pieces went out in two weeks. Hold the line; do not add a fifth channel.`
        : `Only ${published14} pieces in two weeks. One scheduled note is worth more than a new strategy.`,
    to: "/calendar",
  });

  items.push({
    kicker: "Money",
    title: `${formatCurrency(open)} sitting in the pipeline`,
    body: `Collected ${formatCurrency(paid)} this cycle. North & Co. is the one to close — the rate already matches the room.`,
    to: "/monetize",
  });

  if (drafts[0]) {
    const scored = scorePost(drafts[0]);
    items.push({
      kicker: "Desk",
      title: `A draft is at ${scored.score}`,
      body: `"${drafts[0].title}" is waiting. ${scored.notes.find((n) => n.tone === "down")?.text ?? "Ship a shorter version today."}`,
      to: "/create",
      search: { id: drafts[0].id },
    });
  }

  if (next) {
    items.push({
      kicker: "Next",
      title: `Up next on ${PLATFORM_META[next.platform].label}`,
      body: `${next.title}. ${scorePost(next).notes[0]?.text ?? "Leave it. It is ready."}`,
      to: "/calendar",
    });
  }

  if (worst && best && worst.pillar !== best.pillar) {
    items.push({
      kicker: "Gap",
      title: `${worst.pillar} is quiet`,
      body: `You have not given ${worst.pillar.toLowerCase()} a fair week. One precise piece will tell you if the pillar is tired or just unfed.`,
      to: "/grow",
    });
  }

  items.push({
    kicker: "Pulse",
    title:
      delta >= 0
        ? `Engagement ${delta.toFixed(0)}% vs last week`
        : `Engagement ${delta.toFixed(0)}% vs last week`,
    body:
      delta >= 0
        ? `The room is leaning in. Do not spend the lift on a launch. Spend it on the letter.`
        : `A soft week is not a verdict. Look at the two posts that still saved, and make another like them.`,
    to: "/monitor",
  });

  return items.slice(0, 5);
}

export function rangeDelta(stats: DailyStat[], key: keyof DailyStat, days = 7) {
  const last = stats.slice(-days).reduce((a, s) => a + (s[key] as number), 0);
  const prev = stats.slice(-days * 2, -days).reduce((a, s) => a + (s[key] as number), 0);
  const delta = prev ? ((last - prev) / prev) * 100 : 0;
  return { last, prev, delta };
}

export function kpis(posts: Post[], deals: Deal[], stats: DailyStat[]) {
  const impressions = rangeDelta(stats, "impressions");
  const engagement = rangeDelta(stats, "engagement");
  const followersNow = stats.at(-1)?.followers ?? 0;
  const followersPrev = stats.at(-8)?.followers ?? followersNow;
  const followerDelta = followersPrev
    ? ((followersNow - followersPrev) / followersPrev) * 100
    : 0;
  const { paid, open } = revenueTotals(deals);
  const avgRate =
    posts.filter((p) => p.metrics).reduce((a, p) => a + engagementRate(p.metrics), 0) /
    Math.max(1, posts.filter((p) => p.metrics).length);

  return {
    impressions,
    engagement,
    followersNow,
    followerDelta,
    paid,
    open,
    avgRate,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    drafts: posts.filter((p) => p.status === "draft").length,
  };
}

export function formatDelta(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function compactInsightLine(posts: Post[]) {
  const top = topPosts(posts, 1)[0];
  if (!top) return "Publish one piece and the desk will have a pulse.";
  return `Best in the room: “${top.title}” — ${formatNumber(top.metrics?.engagement ?? 0)} engagements.`;
}
