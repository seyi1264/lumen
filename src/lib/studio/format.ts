import { format, formatDistanceToNowStrict, isThisYear, parseISO } from "date-fns";
import type { Platform } from "./types.ts";
import { PLATFORM_META } from "./constants.ts";

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const abs = isThisYear(d) ? format(d, "MMM d, HH:mm") : format(d, "MMM d yyyy");
  return abs;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function platformLabel(p: Platform): string {
  return PLATFORM_META[p].label;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
