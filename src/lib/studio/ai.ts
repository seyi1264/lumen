import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  mode: z.enum(["tighten", "hooks", "thread", "pitch", "repurpose"]),
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

type JsonSchema = {
  type: "OBJECT";
  properties: Record<string, { type: "STRING" | "ARRAY"; items?: { type: "STRING" } }>;
  required: string[];
};

const draftSchema: JsonSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    body: { type: "STRING" },
    cta: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    note: { type: "STRING" },
  },
  required: ["title", "body", "cta", "tags", "note"],
};

const reshapeSchema: JsonSchema = {
  type: "OBJECT",
  properties: {
    body: { type: "STRING" },
    variants: { type: "ARRAY", items: { type: "STRING" } },
    note: { type: "STRING" },
  },
  required: ["body", "variants", "note"],
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function chat(
  system: string,
  user: string,
  responseSchema: JsonSchema,
): Promise<AiOk<{ text: string }> | AiErr> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "The editor is offline. Add GEMINI_API_KEY to Vercel and redeploy.",
    };
  }

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1400,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  if (!res.ok) {
    if (res.status === 401) {
      return {
        ok: false,
        error:
          "Google rejected the Gemini API key (401). Check GEMINI_API_KEY in Vercel and redeploy.",
      };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error:
          "Google denied the Gemini request (403). Check API access, model availability, and project eligibility.",
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        error: "The Gemini free-tier limit was reached. Wait for it to reset and try again.",
      };
    }
    return { ok: false, error: `Gemini API error ${res.status}` };
  }

  const body = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] };
      finishReason?: string;
    }[];
  };
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    return { ok: false, error: "The editor's response was cut off. Try again." };
  }
  const text =
    candidate?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("") ?? "";
  if (!text) return { ok: false, error: "The editor returned a blank page." };
  return { ok: true, text };
}

const SYSTEM = `You are the in-house editor for Lumen, a private studio for a writer named in the prompt.
Write in their voice. Never use emoji, hashtags unless the platform is Instagram, or marketing clichés (unlock, supercharge, game-changing, dive in, journey, leverage as a verb unless the writer does).
Prefer short sentences. Concrete nouns. No preamble.
Always reply with compact JSON only.`;

export const generateDraft = createServerFn({ method: "POST" })
  .validator(draftInput)
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
      draftSchema,
    );
    if (!result.ok) return result;
    const json = parseJsonObject(result.text);
    if (!json) {
      return {
        ok: false,
        error: "The editor returned an invalid response. Try again; a shorter brief may help.",
      };
    }
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
      reshapeSchema,
    );
    if (!result.ok) return result;
    const json = parseJsonObject(result.text);
    if (!json) return { ok: false, error: "The editor hesitated. Try again." };
    return {
      ok: true,
      body: String(json.body ?? ""),
      variants: Array.isArray(json.variants) ? json.variants.map(String).slice(0, 6) : [],
      note: String(json.note ?? ""),
    };
  });
