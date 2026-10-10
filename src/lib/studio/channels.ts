import { PLATFORM_META } from "./constants";
import { firstLine } from "./score";
import type { Platform, Post } from "./types";
import { PLATFORMS } from "./types";

export type ChannelKind = "intent" | "clipboard";

export const CHANNELS: Record<
  Platform,
  {
    kind: ChannelKind;
    compose: string;
    handoff: string;
  }
> = {
  x: {
    kind: "intent",
    compose: "https://x.com/intent/post",
    handoff: "Opens the X composer with the note filled in.",
  },
  linkedin: {
    kind: "clipboard",
    compose: "https://www.linkedin.com/feed/",
    handoff: "Copies the piece, then opens LinkedIn. Paste into the share box.",
  },
  facebook: {
    kind: "clipboard",
    compose: "https://www.facebook.com/",
    handoff: "Copies the piece, then opens Facebook. Paste into the composer.",
  },
  instagram: {
    kind: "clipboard",
    compose: "https://www.instagram.com/",
    handoff: "Copies the caption. Instagram has no web composer — paste in the app.",
  },
  newsletter: {
    kind: "clipboard",
    compose: "mailto:?subject=",
    handoff: "Opens a mail draft with the letter as the body.",
  },
  youtube: {
    kind: "clipboard",
    compose: "https://studio.youtube.com",
    handoff: "Copies title and outline, then opens YouTube Studio.",
  },
};

function clip(text: string, limit: number) {
  const t = text.trim();
  if (t.length <= limit) return t;
  const slice = t.slice(0, Math.max(0, limit - 1));
  const at = slice.lastIndexOf(" ");
  return `${(at > 40 ? slice.slice(0, at) : slice).trim()}…`;
}

function paragraphs(body: string) {
  return body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function adaptCopy(post: Pick<Post, "title" | "body" | "cta">, to: Platform): string {
  const parts = paragraphs(post.body);
  const hook = firstLine(post.body);
  const close = post.cta.trim();
  const limit = PLATFORM_META[to].limit;

  let out = "";
  if (to === "x") {
    out = hook || parts[0] || post.title;
    if (close && `${out}\n\n${close}`.length <= limit) out = `${out}\n\n${close}`;
  } else if (to === "linkedin") {
    out = parts.join("\n\n");
    if (close) out = `${out}\n\n${close}`;
  } else if (to === "facebook") {
    const lead = parts.slice(0, 3).join("\n\n");
    out = close ? `${lead}\n\n${close}` : lead;
  } else if (to === "instagram") {
    out = [hook, parts[1], close].filter(Boolean).join("\n\n");
  } else if (to === "youtube") {
    out = [
      post.title,
      "",
      parts.slice(0, 4).join("\n\n"),
      close ? `\n${close}` : "",
    ].join("\n");
  } else {
    out = [post.title ? `# ${post.title}` : "", parts.join("\n\n"), close]
      .filter(Boolean)
      .join("\n\n");
  }

  return clip(out.trim(), limit);
}

export function composeHref(
  platform: Platform,
  text: string,
  title?: string,
): string {
  const meta = CHANNELS[platform];
  if (platform === "x") {
    return `${meta.compose}?text=${encodeURIComponent(text)}`;
  }
  if (platform === "newsletter") {
    const subject = encodeURIComponent(title || "Letter");
    const body = encodeURIComponent(text);
    return `mailto:?subject=${subject}&body=${body}`;
  }
  return meta.compose;
}

export async function handOffToChannel(
  platform: Platform,
  text: string,
  title?: string,
): Promise<{ copied: boolean; opened: boolean }> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    copied = false;
  }
  const href = composeHref(platform, text, title);
  const popup = window.open(href, "_blank", "noopener,noreferrer");
  return { copied, opened: Boolean(popup) };
}

export function duePosts(posts: Post[], now = new Date()) {
  return posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt)
    .filter((p) => new Date(p.scheduledAt as string).getTime() <= now.getTime())
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
}

export function upcomingQueue(posts: Post[], now = new Date()) {
  return posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt)
    .filter((p) => new Date(p.scheduledAt as string).getTime() > now.getTime())
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
}

export function channelHealth(posts: Post[], platform: Platform) {
  const set = posts.filter((p) => p.platform === platform);
  const scheduled = set.filter((p) => p.status === "scheduled").length;
  const drafts = set.filter((p) => p.status === "draft").length;
  const published = set.filter((p) => p.status === "published").length;
  return { scheduled, drafts, published, total: set.length };
}

export const ALL_ROOMS = PLATFORMS;
