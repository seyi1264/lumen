import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

const draftInput = z.object({
  brief: z.string().min(3).max(800),
  platform: z.enum(["x", "linkedin", "facebook", "instagram", "newsletter", "youtube"]),
  pillar: z.string().max(40),
  voice: z.object({
    name: z.string(),
    audience: z.string(),
    tone: z.string(),
    avoid: z.string(),
  }),
});

const reshapeInput = z.object({
  body: z.string().min(1).max(8000),
  platform: z.enum(["x", "linkedin", "facebook", "instagram", "newsletter", "youtube"]),
  mode: z.enum(["tighten", "hooks", "thread", "pitch", "repurpose", "reply"]),
  targetPlatform: z
    .enum(["x", "linkedin", "facebook", "instagram", "newsletter", "youtube"])
    .optional(),
  voice: z.object({
    name: z.string(),
    audience: z.string(),
    tone: z.string(),
    avoid: z.string(),
  }),
});

export type AiOk<T> = { ok: true } & T;
export type AiErr = { ok: false; error: string };
export type DraftResult = {
  title: string;
  body: string;
  cta: string;
  tags: string[];
  note: string;
};
export type ReshapeResult = {
  body: string;
  variants: string[];
  note: string;
};

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function chat(system: string, user: string): Promise<AiOk<{ text: string }> | AiErr> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "The editor is offline in this environment." };

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.7,
      max_tokens: 700,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: "The editor is unavailable right now. Scoring still runs on the desk.",
      };
    }
    return { ok: false, error: `Editor error ${res.status}` };
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text) return { ok: false, error: "The editor returned a blank page." };
  return { ok: true, text };
}

const SYSTEM = `You are the in-house editor for Lumen, a private studio for a writer named in the prompt.
Write in their voice. Never use emoji, hashtags unless the platform is Instagram, or marketing clichés (unlock, supercharge, game-changing, dive in, journey, leverage as a verb unless the writer does).
Prefer short sentences. Concrete nouns. No preamble.
Always reply with compact JSON only.`;

export const generateDraft = createServerFn({ method: "POST" })
  .validator(draftInput)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<AiOk<DraftResult> | AiErr> => {
    const result = await chat(
      SYSTEM,
      `Voice: ${data.voice.name}
Audience: ${data.voice.audience}
Tone: ${data.voice.tone}
Never: ${data.voice.avoid}
Platform: ${data.platform}
Pillar: ${data.pillar}
Brief: ${data.brief}

Return JSON: {"title":"","body":"","cta":"","tags":[""],"note":"one sentence on why this will work"}
Keep body native to the platform. X: one to four short lines, under 280 chars if possible. LinkedIn: 80–180 words. Instagram: 40–90 words, line breaks. Newsletter: 180–320 words. YouTube: spoken outline, 80–140 words.`,
    );
    if (!result.ok) return result;
    const json = extractJson(result.text);
    if (!json) return { ok: false, error: "Could not parse the draft. Try a shorter brief." };
    return {
      ok: true,
      title: String(json.title ?? "Untitled"),
      body: String(json.body ?? ""),
      cta: String(json.cta ?? ""),
      tags: Array.isArray(json.tags) ? json.tags.map(String).slice(0, 5) : [],
      note: String(json.note ?? ""),
    };
  });

export const reshapeCopy = createServerFn({ method: "POST" })
  .validator(reshapeInput)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<AiOk<ReshapeResult> | AiErr> => {
    const intent =
      data.mode === "tighten"
        ? "Tighten the copy. Cut 20–30%. Keep the idea. No new claims."
        : data.mode === "hooks"
          ? "Write 4 alternate opening lines, each under 90 characters, different angles."
          : data.mode === "thread"
            ? "Turn this into a 5–7 post X thread. Numbered. First line must stand alone."
            : data.mode === "pitch"
              ? "Write a 90-word sponsorship pitch an operator would actually read. Include a rate suggestion as a range, no theatrics."
              : data.mode === "reply"
                ? "Write one concise, direct reply to the comment. Address its actual point, stay in the writer's voice, do not invent facts, and do not pretend to have posted it."
              : `Repurpose this for ${data.targetPlatform ?? "x"} without sounding like a cross-post.`;

    const result = await chat(
      SYSTEM,
      `Voice: ${data.voice.name}
Tone: ${data.voice.tone}
Never: ${data.voice.avoid}
Platform: ${data.platform}
Task: ${intent}

Original:
${data.body}

Return JSON: {"body":"primary rewrite or thread","variants":["..."],"note":"one editorial sentence"}
For hooks, put the four lines in variants and leave body as the best one.`,
    );
    if (!result.ok) return result;
    const json = extractJson(result.text);
    if (!json) return { ok: false, error: "The editor hesitated. Try again." };
    return {
      ok: true,
      body: String(json.body ?? ""),
      variants: Array.isArray(json.variants) ? json.variants.map(String).slice(0, 6) : [],
      note: String(json.note ?? ""),
    };
  });
