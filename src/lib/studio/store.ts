import { formatISO } from "date-fns";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { adaptCopy } from "./channels.ts";
import { hashString } from "./format.ts";
import {
  buildDailyStats,
  createSeedDeals,
  createSeedExperiments,
  createSeedPosts,
  DEFAULT_VOICE,
} from "./seed.ts";
import type {
  BrandVoice,
  DailyStat,
  Deal,
  Experiment,
  Platform,
  Post,
  PostStatus,
} from "./types.ts";
import { PLATFORMS } from "./types.ts";

export type ChannelPref = { enabled: boolean };

export type StudioState = {
  hydrated: boolean;
  voice: BrandVoice;
  posts: Post[];
  deals: Deal[];
  experiments: Experiment[];
  stats: DailyStat[];
  channels: Record<Platform, ChannelPref>;
  hydrate: () => void;
  resetStudio: () => void;
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

function simulatedMetrics(post: Post) {
  const h = hashString(post.id + post.body.slice(0, 40));
  const base = 900 + (h % 8000);
  const lift = 0.7 + ((h >> 8) % 80) / 100;
  const impressions = Math.round(base * lift * (post.platform === "x" ? 1.6 : 1));
  const engagement = Math.round(impressions * (0.04 + ((h >> 4) % 40) / 1000));
  const clicks = Math.round(engagement * 0.22);
  const saves = Math.round(engagement * 0.18);
  return { impressions, engagement, clicks, saves };
}

function isLegacySeededVoice(voice?: Partial<BrandVoice>) {
  return voice?.name === "Nia Okonkwo" || voice?.handle === "@niaokonkwo";
}

function clearLegacyMockStudioData() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("lumen-studio-v1");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: Partial<StudioState> } | null;
    const voice = parsed?.state?.voice;
    if (isLegacySeededVoice(voice)) {
      window.localStorage.removeItem("lumen-studio-v1");
    }
  } catch {
    // Ignore malformed persisted storage and fall back to a clean starter state.
  }
}

clearLegacyMockStudioData();

function snapshot() {
  return {
    voice: DEFAULT_VOICE,
    posts: [],
    deals: [],
    experiments: [],
    stats: [],
    channels: defaultChannels(),
  };
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...snapshot(),
      hydrate: () => {
        if (get().hydrated) return;
        void useStudioStore.persist.rehydrate();
        set({ hydrated: true });
      },
      resetStudio: () => set({ ...snapshot(), hydrated: true }),
      setVoice: (voice) => set({ voice: { ...get().voice, ...voice } }),
      setChannel: (platform, pref) => {
        const prev = get().channels[platform] ?? { enabled: true };
        set({
          channels: {
            ...get().channels,
            [platform]: { ...prev, ...pref },
          },
        });
      },
      upsertPost: (post) => {
        const posts = get().posts;
        const idx = posts.findIndex((p) => p.id === post.id);
        const next =
          idx === -1
            ? [post, ...posts]
            : posts.map((p) => (p.id === post.id ? post : p));
        set({ posts: next, stats: buildDailyStats(next, get().deals) });
      },
      deletePost: (id) => {
        const posts = get().posts.filter((p) => p.id !== id);
        set({ posts, stats: buildDailyStats(posts, get().deals) });
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
        set({ posts, stats: buildDailyStats(posts, get().deals) });
      },
      publishPost: (id) => {
        const posts = get().posts.map((p) => {
          if (p.id !== id) return p;
          const metrics = p.metrics ?? simulatedMetrics(p);
          return {
            ...p,
            status: "published" as const,
            publishedAt: stamp(),
            scheduledAt: p.scheduledAt,
            metrics,
            updatedAt: stamp(),
          };
        });
        set({ posts, stats: buildDailyStats(posts, get().deals) });
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
        set({ posts: [copy, ...get().posts] });
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
                ? {
                    ...p,
                    status,
                    scheduledAt: when ?? p.scheduledAt,
                    updatedAt: stampNow,
                  }
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
        set({ posts, stats: buildDailyStats(posts, get().deals) });
        return ids;
      },
      addDeal: (deal) => {
        const deals = [deal, ...get().deals];
        set({ deals, stats: buildDailyStats(get().posts, deals) });
      },
      updateDeal: (id, patch) => {
        const deals = get().deals.map((d) => (d.id === id ? { ...d, ...patch } : d));
        set({ deals, stats: buildDailyStats(get().posts, deals) });
      },
      deleteDeal: (id) => {
        const deals = get().deals.filter((d) => d.id !== id);
        set({ deals, stats: buildDailyStats(get().posts, deals) });
      },
      setExperimentStatus: (id, status, result) => {
        set({
          experiments: get().experiments.map((e) =>
            e.id === id ? { ...e, status, result: result ?? e.result } : e,
          ),
        });
      },
    }),
    {
      name: "lumen-studio-v1",
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>;
        return {
          ...current,
          ...p,
          channels: { ...current.channels, ...p.channels },
        };
      },
      partialize: (state) => ({
        voice: state.voice,
        posts: state.posts,
        deals: state.deals,
        experiments: state.experiments,
        stats: state.stats,
        channels: state.channels,
      }),
    },
  ),
);
