import { getSupabase } from "./client";
import { buildDailyStats } from "@/lib/studio/seed";
import type { useStudioStore } from "@/lib/studio/store";
import type { BrandVoice, Deal, Experiment, Platform, Post } from "@/lib/studio/types";
import { PLATFORMS } from "@/lib/studio/types";

type Studio = ReturnType<typeof useStudioStore.getState>;

type PostRow = {
  id: string;
  title: string;
  body: string;
  platform: Platform;
  status: Post["status"];
  scheduled_at: string | null;
  published_at: string | null;
  tags: string[] | null;
  pillar: Post["pillar"];
  cta: string | null;
  metrics: Post["metrics"];
  created_at: string;
  updated_at: string;
};

type DealRow = {
  id: string;
  brand: string;
  type: Deal["type"];
  amount: number | string;
  status: Deal["status"];
  due_at: string | null;
  notes: string | null;
};

type ExperimentRow = {
  id: string;
  title: string;
  hypothesis: string | null;
  status: Experiment["status"];
  result: string | null;
};

type ProfileRow = {
  name: string | null;
  handle: string | null;
  audience: string | null;
  tone: string | null;
  avoid: string | null;
  channels: Partial<Record<Platform, { enabled?: boolean }>> | null;
};

function channelsFrom(raw: ProfileRow["channels"]) {
  return Object.fromEntries(
    PLATFORMS.map((p) => [p, { enabled: raw?.[p]?.enabled !== false }]),
  ) as Studio["channels"];
}

export async function pullStudio(): Promise<{
  voice: BrandVoice;
  posts: Post[];
  deals: Deal[];
  experiments: Experiment[];
  channels: Studio["channels"];
} | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, postsRes, dealsRes, experimentsRes] = await Promise.all([
    sb.from("profiles").select("name, handle, audience, tone, avoid, channels").eq("user_id", user.id).maybeSingle(),
    sb.from("posts").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    sb.from("deals").select("*").eq("user_id", user.id),
    sb.from("experiments").select("*").eq("user_id", user.id),
  ]);

  const failed = [profileRes, postsRes, dealsRes, experimentsRes].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const profile = (profileRes.data ?? null) as ProfileRow | null;
  if (!profile) {
    const { error } = await sb.from("profiles").insert({ user_id: user.id });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
  }

  const posts = ((postsRes.data ?? []) as PostRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    platform: row.platform,
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    tags: row.tags ?? [],
    pillar: row.pillar,
    cta: row.cta ?? "",
    metrics: row.metrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const deals = ((dealsRes.data ?? []) as DealRow[]).map((row) => ({
    id: row.id,
    brand: row.brand,
    type: row.type,
    amount: Number(row.amount) || 0,
    status: row.status,
    dueAt: row.due_at,
    notes: row.notes ?? "",
  }));
  const experiments = ((experimentsRes.data ?? []) as ExperimentRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    hypothesis: row.hypothesis ?? "",
    status: row.status,
    result: row.result ?? "",
  }));

  return {
    voice: {
      name: profile?.name ?? "",
      handle: profile?.handle ?? "",
      audience: profile?.audience ?? "",
      tone: profile?.tone ?? "",
      avoid: profile?.avoid ?? "",
    },
    posts,
    deals,
    experiments,
    channels: channelsFrom(profile?.channels ?? null),
  };
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pushing = false;

export function schedulePush() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void pushStudio();
  }, 400);
}

export async function pushStudio() {
  if (pushing) {
    schedulePush();
    return;
  }
  const sb = getSupabase();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return;

  pushing = true;
  try {
    const { useStudioStore } = await import("@/lib/studio/store");
    const state = useStudioStore.getState();
    const userId = user.id;

    const profile = await sb.from("profiles").upsert({
      user_id: userId,
      name: state.voice.name,
      handle: state.voice.handle,
      audience: state.voice.audience,
      tone: state.voice.tone,
      avoid: state.voice.avoid,
      channels: state.channels,
    });
    if (profile.error) throw new Error(profile.error.message);

    await replaceTable(
      "posts",
      userId,
      state.posts.map((post) => ({
        id: post.id,
        user_id: userId,
        title: post.title,
        body: post.body,
        platform: post.platform,
        status: post.status,
        scheduled_at: post.scheduledAt,
        published_at: post.publishedAt,
        tags: post.tags,
        pillar: post.pillar,
        cta: post.cta,
        metrics: post.metrics,
        created_at: post.createdAt,
        updated_at: post.updatedAt,
      })),
    );
    await replaceTable(
      "deals",
      userId,
      state.deals.map((deal) => ({
        id: deal.id,
        user_id: userId,
        brand: deal.brand,
        type: deal.type,
        amount: deal.amount,
        status: deal.status,
        due_at: deal.dueAt,
        notes: deal.notes,
      })),
    );
    await replaceTable(
      "experiments",
      userId,
      state.experiments.map((item) => ({
        id: item.id,
        user_id: userId,
        title: item.title,
        hypothesis: item.hypothesis,
        status: item.status,
        result: item.result,
      })),
    );
  } catch (err) {
    const { toast } = await import("sonner");
    const message = err instanceof Error ? err.message : "Could not save to Supabase.";
    toast.error(
      message.toLowerCase().includes("relation") || message.toLowerCase().includes("schema")
        ? "Supabase has no Lumen tables yet. Run the SQL from the connect screen."
        : message,
    );
  } finally {
    pushing = false;
  }
}

async function replaceTable(
  table: "posts" | "deals" | "experiments",
  userId: string,
  rows: Record<string, unknown>[],
) {
  const sb = getSupabase();
  if (!sb) return;
  const existing = await sb.from(table).select("id").eq("user_id", userId);
  if (existing.error) throw new Error(existing.error.message);
  const keep = new Set(rows.map((row) => String(row.id)));
  const stale = ((existing.data ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !keep.has(id));
  if (rows.length) {
    const saved = await sb.from(table).upsert(rows);
    if (saved.error) throw new Error(saved.error.message);
  }
  if (stale.length) {
    const removed = await sb.from(table).delete().in("id", stale).eq("user_id", userId);
    if (removed.error) throw new Error(removed.error.message);
  }
}
