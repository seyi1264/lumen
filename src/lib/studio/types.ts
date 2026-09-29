export const PLATFORMS = [
  "x",
  "linkedin",
  "facebook",
  "instagram",
  "newsletter",
  "youtube",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const POST_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const DEAL_TYPES = [
  "sponsorship",
  "affiliate",
  "product",
  "subscription",
] as const;

export type DealType = (typeof DEAL_TYPES)[number];

export const DEAL_STATUSES = ["pipeline", "active", "paid"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const PILLARS = [
  "Attention",
  "Craft",
  "Independence",
  "Leverage",
  "Money",
] as const;

export type Pillar = (typeof PILLARS)[number];

export type PostMetrics = {
  impressions: number;
  engagement: number;
  clicks: number;
  saves: number;
};

export type Post = {
  id: string;
  title: string;
  body: string;
  platform: Platform;
  status: PostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  tags: string[];
  pillar: Pillar;
  cta: string;
  createdAt: string;
  updatedAt: string;
  metrics: PostMetrics | null;
};

export type Deal = {
  id: string;
  brand: string;
  type: DealType;
  amount: number;
  status: DealStatus;
  dueAt: string | null;
  notes: string;
};

export type BrandVoice = {
  name: string;
  handle: string;
  audience: string;
  tone: string;
  avoid: string;
};

export type Experiment = {
  id: string;
  title: string;
  hypothesis: string;
  status: "queued" | "running" | "learned";
  result: string;
};

export type DailyStat = {
  date: string;
  impressions: number;
  engagement: number;
  followers: number;
  revenue: number;
};
