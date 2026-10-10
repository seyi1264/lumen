import { formatISO } from "date-fns";
import { create } from "zustand";
import { adaptCopy } from "./channels";
import { buildDailyStats, EMPTY_VOICE } from "./seed";
import type {
  BrandVoice,
  DailyStat,
  Deal,
  Experiment,
  Platform,
  Post,
  PostStatus,
} from "./types";
import { PLATFORMS } from "./types";

export type ChannelPref = { enabled: boolean };

export type StudioSnapshot = {
  voice: BrandVoice;
  posts: Post[];
  deals: Deal[];
  experiments: Experiment[];
  channels: Record<Platform, ChannelPref>;
};

export type StudioState = StudioSnapshot & {
  hydrated: boolean;
  stats: DailyStat[];
  hydrate: () => void;
  replaceStudio: (snap: StudioSnapshot) => void;
  clearStudio: () => void;
  setVoice: (voice: Partial<BrandVoice>) => void;
  setChannel: (platform: Platform, pref: Partial<ChannelPref>) => void;
  upsertPost: (post: Post) => void;
  deletePost: (id: string) => void;
  setPostStatus: (id: string, status: PostStatus, when?: string | null) => void;
  publishPost: (id: string) => void;
  duplicateToPlatform: (id: string, platform: Platform) => string;
  syndicatePost: (id: string, rooms: Platform[], when?: string | null) => string[];
  addDeal: (deal: Deal) => void;
  updateDeal: (id: string, patch: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  setExperimentStatus: (id: string, status: Experiment["status"], result?: string) => void;
};

function stamp(): string {
  return formatISO(new Date());
}

function defaultChannels(): Record<Platform, ChannelPref> {
  return Object.fromEntries(PLATFORMS.map((p) => [p, { enabled: true }])) as Record<
    Platform,
    ChannelPref
  >;
}

function emptySnapshot(): StudioSnapshot {
  return {
    voice: EMPTY_VOICE,
    posts: [],
    deals: [],
    experiments: [],
    channels: defaultChannels(),
  };
}

function queueSave() {
  void import("@/lib/supabase/sync").then((mod) => mod.schedulePush());
}

export const useStudioStore = create<StudioState>()((set, get) => ({
  hydrated: false,
  ...emptySnapshot(),
  stats: buildDailyStats([], []),
  hydrate: () => set({ hydrated: true }),
  replaceStudio: (snap) =>
    set({
      ...snap,
      ...withStats(snap.posts, snap.deals),
      hydrated: true,
    }),
  clearStudio: () => set({ ...emptySnapshot(), ...withStats([], []), hydrated: true }),
  setVoice: (voice) => {
    set({ voice: { ...get().voice, ...voice } });
    queueSave();
  },
  setChannel: (platform, pref) => {
    const prev = get().channels[platform] ?? { enabled: true };
    set({
      channels: {
        ...get().channels,
        [platform]: { ...prev, ...pref },
      },
    });
    queueSave();
  },
  upsertPost: (post) => {
    const posts = get().posts;
    const idx = posts.findIndex((p) => p.id === post.id);
    const next = idx === -1 ? [post, ...posts] : posts.map((p) => (p.id === post.id ? post : p));
    set({ posts: next, ...withStats(next, get().deals) });
    queueSave();
  },
  deletePost: (id) => {
    const posts = get().posts.filter((p) => p.id !== id);
    set({ posts, ...withStats(posts, get().deals) });
    queueSave();
  },
  setPostStatus: (id, status, when) => {
    const posts = get().posts.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        status,
        scheduledAt: status === "scheduled" ? (when ?? p.scheduledAt) : p.scheduledAt,
        publishedAt: status === "published" ? (when ?? p.publishedAt ?? stamp()) : p.publishedAt,
        updatedAt: stamp(),
      };
    });
    set({ posts, ...withStats(posts, get().deals) });
    queueSave();
  },
  publishPost: (id) => {
    const posts = get().posts.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        status: "published" as const,
        publishedAt: stamp(),
        updatedAt: stamp(),
      };
    });
    set({ posts, ...withStats(posts, get().deals) });
    queueSave();
  },
  duplicateToPlatform: (id, platform) => {
    const source = get().posts.find((p) => p.id === id);
    if (!source) return id;
    const copy: Post = {
      ...source,
      id: crypto.randomUUID(),
      platform,
      body: adaptCopy(source, platform),
      status: "draft",
      scheduledAt: null,
      publishedAt: null,
      metrics: null,
      createdAt: stamp(),
      updatedAt: stamp(),
    };
    const posts = [copy, ...get().posts];
    set({ posts, ...withStats(posts, get().deals) });
    queueSave();
    return copy.id;
  },
  syndicatePost: (id, rooms, when) => {
    const source = get().posts.find((p) => p.id === id);
    if (!source) return [];
    const ids: string[] = [];
    let posts = [...get().posts];
    const stampNow = stamp();
    const status: PostStatus = when ? "scheduled" : "draft";
    for (const room of rooms) {
      if (room === source.platform) {
        posts = posts.map((p) =>
          p.id === source.id
            ? { ...p, status, scheduledAt: when ?? p.scheduledAt, updatedAt: stampNow }
            : p,
        );
        ids.push(source.id);
        continue;
      }
      const copy: Post = {
        ...source,
        id: crypto.randomUUID(),
        platform: room,
        body: adaptCopy(source, room),
        status,
        scheduledAt: when ?? null,
        publishedAt: null,
        metrics: null,
        createdAt: stampNow,
        updatedAt: stampNow,
      };
      posts = [copy, ...posts];
      ids.push(copy.id);
    }
    set({ posts, ...withStats(posts, get().deals) });
    queueSave();
    return ids;
  },
  addDeal: (deal) => {
    const deals = [deal, ...get().deals];
    set({ deals, ...withStats(get().posts, deals) });
    queueSave();
  },
  updateDeal: (id, patch) => {
    const deals = get().deals.map((d) => (d.id === id ? { ...d, ...patch } : d));
    set({ deals, ...withStats(get().posts, deals) });
    queueSave();
  },
  deleteDeal: (id) => {
    const deals = get().deals.filter((d) => d.id !== id);
    set({ deals, ...withStats(get().posts, deals) });
    queueSave();
  },
  setExperimentStatus: (id, status, result) => {
    set({
      experiments: get().experiments.map((e) =>
        e.id === id ? { ...e, status, result: result ?? e.result } : e,
      ),
    });
    queueSave();
  },
}));

function withStats(posts: Post[], deals: Deal[]): { stats: DailyStat[] } {
  return { stats: buildDailyStats(posts, deals) };
}
