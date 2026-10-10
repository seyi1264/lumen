import { formatISO, startOfDay, subDays } from "date-fns";
import type { BrandVoice, DailyStat, Deal, Post } from "./types";

export const EMPTY_VOICE: BrandVoice = {
  name: "",
  handle: "",
  audience: "",
  tone: "",
  avoid: "",
};

/** Counts only what you actually published or collected. No invented baseline. */
export function buildDailyStats(posts: Post[], deals: Deal[], now = new Date()): DailyStat[] {
  const stats: DailyStat[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = startOfDay(subDays(now, i));
    const key = formatISO(d, { representation: "date" });
    let impressions = 0;
    let engagement = 0;
    let revenue = 0;

    for (const post of posts) {
      if (post.status !== "published" || !post.publishedAt || !post.metrics) continue;
      const pub = formatISO(startOfDay(new Date(post.publishedAt)), { representation: "date" });
      if (pub !== key) continue;
      impressions += post.metrics.impressions;
      engagement += post.metrics.engagement;
    }

    for (const deal of deals) {
      if (deal.status !== "paid" || !deal.dueAt) continue;
      const due = formatISO(startOfDay(new Date(deal.dueAt)), { representation: "date" });
      if (due === key) revenue += deal.amount;
    }

    stats.push({ date: key, impressions, engagement, followers: 0, revenue });
  }
  return stats;
}
