import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "lumen-supabase";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let client: SupabaseClient | null = null;
let clientKey = "";

export function readConfig(): SupabaseConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (envUrl && envKey) return { url: envUrl.replace(/\/+$/, ""), anonKey: envKey };
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    if (!parsed.url || !parsed.anonKey) return null;
    return { url: parsed.url.replace(/\/+$/, ""), anonKey: parsed.anonKey };
  } catch {
    return null;
  }
}

export function saveConfig(config: SupabaseConfig) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ url: config.url.replace(/\/+$/, ""), anonKey: config.anonKey.trim() }),
  );
  client = null;
  clientKey = "";
}

export function clearConfig() {
  window.localStorage.removeItem(STORAGE_KEY);
  client = null;
  clientKey = "";
}

export function getSupabase(): SupabaseClient | null {
  const config = readConfig();
  if (!config) return null;
  const key = `${config.url}|${config.anonKey}`;
  if (!client || clientKey !== key) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    clientKey = key;
  }
  return client;
}
