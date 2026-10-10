const KEY = "lumen-buffer-key";

export function readBufferKey(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(KEY)?.trim();
  return value || null;
}

export function saveBufferKey(key: string) {
  window.localStorage.setItem(KEY, key.trim());
}

export function clearBufferKey() {
  window.localStorage.removeItem(KEY);
}

export const BUFFER_SERVICE: Record<string, string> = {
  x: "twitter",
  linkedin: "linkedin",
  facebook: "facebook",
  instagram: "instagram",
  youtube: "youtube",
};
