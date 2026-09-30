import { createClient } from "@supabase/supabase-js";

/** Thrown when a request does not carry a valid Supabase session. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/** Verify a Supabase access token remotely and return its trusted identity. */
export async function getSessionUser(
  accessToken?: string,
): Promise<VerifiedUser | null> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!accessToken || !url || !anonKey) return null;

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Resolve the signed-in user id or reject the server function with 401. */
export async function requireUserId(accessToken?: string): Promise<string> {
  const user = await getSessionUser(accessToken);
  if (!user) throw new UnauthorizedError();
  return user.id;
}