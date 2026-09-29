import { PLATFORM_META } from "./constants";
import { clamp } from "./format";
import type { Platform, Post } from "./types";

export type ScoreNote = {
  tone: "up" | "down" | "neutral";
  text: string;
};

export type ScoreResult = {
  score: number;
  notes: ScoreNote[];
  hook: string;
  chars: number;
  overLimit: boolean;
};

const CTA_HINT =
  /\b(subscribe|reply|comment|follow|read|watch|join|download|buy|share|save|link in|let me know|tell me)\b/i;

export function firstLine(body: string): string {
  const line = body
    .split(/\n+/)
    .map((l) => l.trim())
    .find(Boolean);
  return line ?? "";
}

export function scoreDraft(input: {
  body: string;
  platform: Platform;
  cta: string;
  pillar?: string;
  recentBodies?: string[];
}): ScoreResult {
  const body = input.body.trim();
  const chars = body.length;
  const limit = PLATFORM_META[input.platform].limit;
  const hook = firstLine(body);
  const notes: ScoreNote[] = [];
  let score = 42;

  if (!body) {
    return {
      score: 0,
      notes: [{ tone: "neutral", text: "Write a first line. The rest will follow." }],
      hook: "",
      chars: 0,
      overLimit: false,
    };
  }

  if (hook.length >= 12 && hook.length <= 90) {
    score += 10;
    notes.push({ tone: "up", text: "Opening line is short enough to land." });
  } else if (hook.length > 140) {
    score -= 8;
    notes.push({
      tone: "down",
      text: "The first sentence is long. Cut it in half.",
    });
  } else if (hook.length < 12) {
    score -= 4;
    notes.push({ tone: "down", text: "The opening is too thin to hold attention." });
  }

  if (/\?/.test(hook)) {
    score += 6;
    notes.push({ tone: "up", text: "A question in the first line invites a pause." });
  }
  if (/\b\d{1,4}\b/.test(hook) || /\$\d/.test(hook)) {
    score += 5;
    notes.push({ tone: "up", text: "A number makes the claim concrete." });
  }

  const specific =
    (body.match(/\b(\d+|\$[\d,]+|[A-Z][a-z]+ [A-Z][a-z]+)\b/g) ?? []).length;
  if (specific >= 3) {
    score += 8;
    notes.push({ tone: "up", text: "Named details and figures keep this from floating." });
  } else {
    score -= 4;
    notes.push({
      tone: "down",
      text: "Add one named example or a real number.",
    });
  }

  const hasCta = Boolean(input.cta.trim()) || CTA_HINT.test(body);
  if (hasCta) {
    score += 7;
    notes.push({ tone: "up", text: "There is a place for the reader to go next." });
  } else {
    score -= 5;
    notes.push({ tone: "down", text: "No clear close. Ask for a reply, a save, or a click." });
  }

  const overLimit = chars > limit;
  if (overLimit) {
    score -= 14;
    notes.push({
      tone: "down",
      text: `${chars - limit} characters over the ${PLATFORM_META[input.platform].label} limit.`,
    });
  } else if (input.platform === "x" && chars >= 80 && chars <= 240) {
    score += 6;
    notes.push({ tone: "up", text: "Length fits a single decisive note." });
  } else if (input.platform === "newsletter" && chars < 600) {
    score -= 6;
    notes.push({
      tone: "down",
      text: "This letter is short. Give the idea a second beat.",
    });
  } else if (input.platform === "linkedin" && chars < 180) {
    score -= 4;
    notes.push({ tone: "down", text: "LinkedIn rewards a little more room than this." });
  }

  const words = body.split(/\s+/).filter(Boolean);
  const avg = words.length ? body.length / words.length : 0;
  if (avg > 7.2) {
    score -= 5;
    notes.push({ tone: "down", text: "Sentences are dense. Break one of them." });
  }

  if (input.recentBodies && input.recentBodies.length) {
    const stem = hook.slice(0, 28).toLowerCase();
    const repeat = input.recentBodies.some(
      (b) => firstLine(b).slice(0, 28).toLowerCase() === stem && stem.length > 10,
    );
    if (repeat) {
      score -= 10;
      notes.push({
        tone: "down",
        text: "This opening echoes a recent post. Change the angle.",
      });
    }
  }

  notes.push({
    tone: "neutral",
    text: `Best window on ${PLATFORM_META[input.platform].label}: ${PLATFORM_META[input.platform].bestWindows}.`,
  });

  return {
    score: clamp(Math.round(score), 4, 98),
    notes: notes.slice(0, 5),
    hook,
    chars,
    overLimit,
  };
}

export function scorePost(
  post: Pick<Post, "body" | "platform" | "cta">,
  recentBodies?: string[],
): ScoreResult {
  return scoreDraft({ ...post, recentBodies });
}

export function engagementRate(metrics: { impressions: number; engagement: number } | null) {
  if (!metrics || metrics.impressions <= 0) return 0;
  return (metrics.engagement / metrics.impressions) * 100;
}
