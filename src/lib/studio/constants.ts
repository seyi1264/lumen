import type { DealType, Platform, PostStatus } from "./types";

export const PLATFORM_META: Record<
  Platform,
  {
    label: string;
    short: string;
    limit: number;
    bestWindows: string;
    cadence: string;
  }
> = {
  x: {
    label: "X",
    short: "X",
    limit: 280,
    bestWindows: "Tue–Thu, 8–10",
    cadence: "5 notes / week",
  },
  linkedin: {
    label: "LinkedIn",
    short: "IN",
    limit: 3000,
    bestWindows: "Tue–Wed, 7–9",
    cadence: "3 posts / week",
  },
  facebook: {
    label: "Facebook",
    short: "FB",
    limit: 5000,
    bestWindows: "Wed–Fri, 12–15",
    cadence: "4 posts / week",
  },
  instagram: {
    label: "Instagram",
    short: "IG",
    limit: 2200,
    bestWindows: "Fri–Sun, 18–21",
    cadence: "4 posts / week",
  },
  newsletter: {
    label: "Newsletter",
    short: "NL",
    limit: 8000,
    bestWindows: "Thu, 7:00",
    cadence: "1 letter / week",
  },
  youtube: {
    label: "YouTube",
    short: "YT",
    limit: 5000,
    bestWindows: "Sat, 10:00",
    cadence: "1 video / week",
  },
};

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  sponsorship: "Sponsorship",
  affiliate: "Affiliate",
  product: "Product",
  subscription: "Membership",
};

export const AUDIENCE = {
  x: 31420,
  linkedin: 12180,
  facebook: 8640,
  instagram: 2940,
  newsletter: 4860,
  youtube: 1620,
} as const;

export const AUDIENCE_TOTAL = Object.values(AUDIENCE).reduce((a, b) => a + b, 0);
