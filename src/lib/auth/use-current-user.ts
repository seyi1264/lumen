import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** Retained for compatibility; Supabase Auth never returns a fallback user. */
  isDevFallback: boolean;
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

/**
 * Current user + loading state from the browser's Supabase Auth session.
 *
 * Protect a route by waiting out `isPending` before acting on `user` —
 * redirecting on `user: null` alone bounces signed-in visitors to sign-in on
 * every hard reload:
 *
 *   import { RedirectToSignIn } from "@/lib/auth/gates";
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;              // still resolving — don't redirect yet
 *   if (!user) return <RedirectToSignIn />;  // definitely signed out
 *
 */
export function useCurrentUserState(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    isPending: true,
  });

  useEffect(() => {
    let active = true;
    let supabase: SupabaseClient;
    try {
      supabase = getSupabaseClient();
    } catch {
      setState({ user: null, isPending: false });
      return;
    }

    const mapUser = (user: User | null): AppUser | null => {
      if (!user) return null;
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
      const image = user.user_metadata?.avatar_url;
      return {
        id: user.id,
        displayName: typeof name === "string" ? name : null,
        primaryEmail: user.email ?? null,
        profileImageUrl: typeof image === "string" ? image : null,
        isDevFallback: false,
      };
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: mapUser(session?.user ?? null), isPending: false });
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (active) setState({ user: mapUser(sessionData.session?.user ?? null), isPending: false });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/**
 * Convenience view of `useCurrentUserState().user` for display (e.g.
 * `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
 * for redirects/guards use `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
