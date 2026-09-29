import { addDays, addHours, formatISO, startOfDay, subDays } from "date-fns";
import { AUDIENCE_TOTAL } from "./constants";
import { hashString } from "./format";
import type { BrandVoice, DailyStat, Deal, Experiment, Post } from "./types";

/** Frozen so SSR and the first client paint share the same desk. */
export const STUDIO_NOW = new Date("2026-09-28T15:19:00+01:00");

function iso(d: Date) {
  return formatISO(d);
}

export const DEFAULT_VOICE: BrandVoice = {
  name: "Nia Okonkwo",
  handle: "@niaokonkwo",
  audience:
    "Independent operators, writers, and founders who care about the work more than the performance of work.",
  tone: "Calm, precise, slightly wry. Short sentences. No hype. Concrete examples from the desk, not the stage.",
  avoid: "Growth-hacking slang, fake urgency, guru energy, and advice you would not take yourself.",
};

export function createSeedPosts(now = STUDIO_NOW): Post[] {
  const day = (n: number) => subDays(now, n);
  const ahead = (n: number, h = 9) => addHours(startOfDay(addDays(now, n)), h);

  const rows: Omit<Post, "createdAt" | "updatedAt">[] = [
    {
      id: "p-letter-attention",
      title: "The quiet tax of being reachable",
      body: `Most people do not have an attention problem. They have an availability problem.

If your day can be interrupted by anyone with your number, your calendar, or a clever subject line, you will spend the best hours of your life on other people's emergencies.

I closed public DMs in March. Revenue did not drop. The work got heavier in the right way: fewer conversations, more finished pages.

The tax is not the message. The tax is the version of you that stays slightly braced, all day, for the next one.

A closed door is not hostility. It is how a body of work gets made.`,
      platform: "newsletter",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(12)),
      tags: ["attention", "boundaries"],
      pillar: "Attention",
      cta: "Forward to one person who is too reachable.",
      metrics: { impressions: 18420, engagement: 2140, clicks: 860, saves: 540 },
    },
    {
      id: "p-x-busy",
      title: "Busy as avoidance",
      body: "The people who look busiest on the internet are often the ones avoiding the one piece of work that would actually change their numbers.",
      platform: "x",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(2)),
      tags: ["craft"],
      pillar: "Craft",
      cta: "",
      metrics: { impressions: 41280, engagement: 3180, clicks: 210, saves: 890 },
    },
    {
      id: "p-li-rate",
      title: "How I set a rate without a media kit",
      body: `A founder asked how I price a newsletter sponsorship without a media kit.

I don't send a PDF. I send three numbers:

1. Who is in the room (and who is not).
2. What a typical letter does, in clicks, not vibes.
3. What I will not do for the fee.

If a brand needs a 14-page kit to feel safe, they are not buying the room. They are buying theater.

The operators who convert already know what a trusted letter is worth.`,
      platform: "linkedin",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(5)),
      tags: ["money", "sponsorships"],
      pillar: "Money",
      cta: "If you buy sponsorships, reply with the last one that actually worked.",
      metrics: { impressions: 22640, engagement: 1980, clicks: 420, saves: 610 },
    },
    {
      id: "p-ig-desk",
      title: "Tuesday desk",
      body: "One window. One stack of unmarked pages. Coffee gone cold on purpose.\n\nThe work is not the aesthetic. The aesthetic is what is left when you finally sit down.",
      platform: "instagram",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(4)),
      tags: ["studio"],
      pillar: "Craft",
      cta: "Save this for the next time you rearrange the desk instead of writing.",
      metrics: { impressions: 9800, engagement: 1240, clicks: 40, saves: 720 },
    },
    {
      id: "p-yt-leverage",
      title: "One asset, four rooms",
      body: "A letter should not die in the inbox.\n\nThis week's video is the method: one essay, then a note, a short, a talk track, and a sponsorship brief — without rewriting the idea four times.\n\nLeverage is not posting more. It is refusing to start from zero.",
      platform: "youtube",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(9)),
      tags: ["leverage", "systems"],
      pillar: "Leverage",
      cta: "Watch, then steal the checklist in the description.",
      metrics: { impressions: 6400, engagement: 710, clicks: 180, saves: 95 },
    },
    {
      id: "p-x-taste",
      title: "Taste is a filter",
      body: "Taste is not a mood board. It is the willingness to throw away work that is merely fine.",
      platform: "x",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(16)),
      tags: ["craft"],
      pillar: "Craft",
      cta: "",
      metrics: { impressions: 28940, engagement: 2440, clicks: 90, saves: 1010 },
    },
    {
      id: "p-li-independence",
      title: "Independence is a design problem",
      body: `People treat independence like a personality.

It is a design problem. Revenue mix. Calendar. Who can reach you. What you have already said no to in writing.

I still take client work. I take less of it, on a page that states the terms, from people who have read the work.

Freedom that depends on being in a good mood this week is not freedom. It is weather.`,
      platform: "linkedin",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(19)),
      tags: ["independence"],
      pillar: "Independence",
      cta: "What is the last term you wrote down so you would not renegotiate it in the moment?",
      metrics: { impressions: 17320, engagement: 1510, clicks: 260, saves: 430 },
    },
    {
      id: "p-letter-money",
      title: "A small, boring business",
      body: `I used to want a media company. I have a small, boring business instead.

Four letters a month. Two sponsors who already know the room. A paid circle of 380 people who would notice if I disappeared. A shop with three things, not thirty.

Boring is the point. Boring compounds. Boring does not require a new personality every quarter.

If your content business only works when you are inspired, you do not have a business. You have a mood.`,
      platform: "newsletter",
      status: "published",
      scheduledAt: null,
      publishedAt: iso(day(26)),
      tags: ["money", "business"],
      pillar: "Money",
      cta: "Reply with the boring number you are proud of.",
      metrics: { impressions: 15210, engagement: 1880, clicks: 940, saves: 410 },
    },
    {
      id: "p-x-scheduled-1",
      title: "Unfinished on purpose",
      body: "Finish the piece that scares you a little. Leave the clever one in the notes. Clever is a costume. Scare is a signal.",
      platform: "x",
      status: "scheduled",
      scheduledAt: iso(ahead(1, 8)),
      publishedAt: null,
      tags: ["craft"],
      pillar: "Craft",
      cta: "",
      metrics: null,
    },
    {
      id: "p-li-scheduled",
      title: "The media kit I still do not have",
      body: `I still do not have a media kit.

What I have is a rate, a sentence about the room, and a list of brands I will not sit next to.

If that feels incomplete, it is. Completeness is often a way of delaying the ask.

This week I am sending the same three-line note to two companies that already read the letter. I will tell you what they say.`,
      platform: "linkedin",
      status: "scheduled",
      scheduledAt: iso(ahead(2, 8)),
      publishedAt: null,
      tags: ["money"],
      pillar: "Money",
      cta: "If you have sold a sponsorship with three lines, I want the story.",
      metrics: null,
    },
    {
      id: "p-nl-scheduled",
      title: "On keeping a studio small",
      body: `Draft in progress — the letter on why I will not hire a community manager this year, and what I will build instead: a slower room, a clearer offer, fewer channels with more weight.`,
      platform: "newsletter",
      status: "scheduled",
      scheduledAt: iso(ahead(4, 7)),
      publishedAt: null,
      tags: ["independence"],
      pillar: "Independence",
      cta: "Become a member if you want the full method, not the performance of one.",
      metrics: null,
    },
    {
      id: "p-ig-scheduled",
      title: "The stack",
      body: "Five books, none of them about marketing. The underlined one is about walking.\n\nWhat you keep on the desk is the curriculum.",
      platform: "instagram",
      status: "scheduled",
      scheduledAt: iso(ahead(3, 18)),
      publishedAt: null,
      tags: ["studio"],
      pillar: "Attention",
      cta: "",
      metrics: null,
    },
    {
      id: "p-draft-x",
      title: "Audience is not the work",
      body: "Audience is a side effect of being useful in public for a long time. Treat it like the work and you will start performing usefulness instead of practicing it.",
      platform: "x",
      status: "draft",
      scheduledAt: null,
      publishedAt: null,
      tags: ["leverage"],
      pillar: "Leverage",
      cta: "",
      metrics: null,
    },
    {
      id: "p-draft-yt",
      title: "How to price a room",
      body: "Outline: what a room is worth, why follower counts lie, three ways to say no to the wrong sponsor, and the email I actually send.",
      platform: "youtube",
      status: "draft",
      scheduledAt: null,
      publishedAt: null,
      tags: ["money"],
      pillar: "Money",
      cta: "Join the waitlist for the workshop.",
      metrics: null,
    },
  ];

  return rows.map((row) => ({
    ...row,
    createdAt: row.publishedAt ?? row.scheduledAt ?? iso(subDays(now, 20)),
    updatedAt: iso(now),
  }));
}

export function createSeedDeals(now = STUDIO_NOW): Deal[] {
  return [
    {
      id: "d-revery",
      brand: "Revery Paper",
      type: "sponsorship",
      amount: 4200,
      status: "paid",
      dueAt: iso(subDays(now, 18)),
      notes: "Newsletter placement, March letter. They want a second run in May.",
    },
    {
      id: "d-kiln",
      brand: "Kiln Studio Desk",
      type: "sponsorship",
      amount: 3600,
      status: "active",
      dueAt: iso(addDays(now, 9)),
      notes: "LinkedIn + letter. Need the product shot by Friday.",
    },
    {
      id: "d-folio-shop",
      brand: "Field Notes shop",
      type: "product",
      amount: 1860,
      status: "paid",
      dueAt: iso(subDays(now, 6)),
      notes: "Essay pack + print. Quiet launch, no discounting.",
    },
    {
      id: "d-circle",
      brand: "Inner Circle",
      type: "subscription",
      amount: 3800,
      status: "paid",
      dueAt: iso(subDays(now, 2)),
      notes: "380 members × $10. Recurring. Do not cheapen it.",
    },
    {
      id: "d-umbra",
      brand: "Umbra Audio",
      type: "affiliate",
      amount: 640,
      status: "paid",
      dueAt: iso(subDays(now, 11)),
      notes: "Microphone mention in the leverage video.",
    },
    {
      id: "d-north",
      brand: "North & Co.",
      type: "sponsorship",
      amount: 5500,
      status: "pipeline",
      dueAt: iso(addDays(now, 21)),
      notes: "Interested. Waiting on their legal. Rate holds at 5.5 if the letter stays uncluttered.",
    },
  ];
}

export function createSeedExperiments(): Experiment[] {
  return [
    {
      id: "e-no-cta-x",
      title: "Notes without a close",
      hypothesis: "A clean X note with no CTA will save more than one that asks.",
      status: "learned",
      result: "Saves +28%. Replies −11%. Keep for craft notes, not offers.",
    },
    {
      id: "e-thu-letter",
      title: "Thursday 7:00 letters",
      hypothesis: "Moving the letter from Sunday night to Thursday morning lifts clicks.",
      status: "running",
      result: "Two letters in. Click-through is up 16% so far.",
    },
    {
      id: "e-three-line-kit",
      title: "Three-line media note",
      hypothesis: "A three-line rate note outperforms a kit for operators.",
      status: "queued",
      result: "",
    },
  ];
}

export function buildDailyStats(posts: Post[], deals: Deal[], now = STUDIO_NOW): DailyStat[] {
  const published = posts.filter((p) => p.status === "published" && p.publishedAt);
  const days = 56;
  const stats: DailyStat[] = [];
  let followers = AUDIENCE_TOTAL - 1860;

  for (let i = days - 1; i >= 0; i--) {
    const d = startOfDay(subDays(now, i));
    const key = formatISO(d, { representation: "date" });
    const weekday = d.getDay();
    const season = weekday === 0 || weekday === 6 ? 0.82 : weekday === 2 || weekday === 3 ? 1.18 : 1;
    const h = hashString(key);
    const jitter = 0.88 + ((h % 25) / 100);

    let impressions = Math.round(2400 * season * jitter);
    let engagement = Math.round(impressions * 0.055);
    let revenue = 0;

    for (const p of published) {
      const pub = p.publishedAt ? new Date(p.publishedAt) : null;
      if (!pub) continue;
      const age = Math.round((d.getTime() - startOfDay(pub).getTime()) / 86400000);
      if (age < 0 || age > 12) continue;
      const decay = Math.pow(0.72, age);
      const m = p.metrics;
      if (!m) continue;
      impressions += Math.round((m.impressions / 3.4) * decay);
      engagement += Math.round((m.engagement / 3.4) * decay);
    }

    for (const deal of deals) {
      if (deal.status !== "paid" || !deal.dueAt) continue;
      const due = startOfDay(new Date(deal.dueAt));
      if (due.getTime() === d.getTime()) revenue += deal.amount;
      if (deal.type === "subscription" && d.getDate() === 1) revenue += deal.amount;
    }

    const followDelta = Math.round(12 * season * jitter + engagement / 220);
    followers += followDelta;

    stats.push({
      date: key,
      impressions,
      engagement,
      followers,
      revenue,
    });
  }

  return stats;
}
