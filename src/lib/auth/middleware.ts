import { createMiddleware } from "@tanstack/react-start";

/**
 * Supabase Auth middleware for server functions — the standard way to get the
 * caller's verified user id. The browser forwards its access token through the
 * `.client` hook; the server verifies it with Supabase before invoking a handler.
 *
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { getSql } from "@/lib/db";
 *   import { authMiddleware } from "@/lib/auth/middleware";
 *
 *   export const listTodos = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       const sql = await getSql();
 *       return sql`select * from todos where user_id = ${context.userId}`;
 *     });
 *
 * Signed-out visitors and invalid tokens receive `UnauthorizedError` (see
 * `verify.server.ts`). Use this on every server function that touches per-user
 * data and scope every query by `context.userId`.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getSupabaseAccessToken } = await import("../supabase/client");
    return next({
      sendContext: { supabaseToken: (await getSupabaseAccessToken()) ?? undefined },
    });
  })
  .server(async ({ next, context }) => {
    // ONLY import `*.server` modules here. This file is dual client/server
    // (bearer hook on the client). A plain `./isolation` path was renamed to
    // `isolation.server.ts` — keep this import in sync so image `tsc` resolves
    // it, and so Vite does not ship `@tanstack/react-start/server` to the browser.
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId } = await import("./verify.server");
    // Reject scripted cross-site/sibling requests before touching per-user data.
    assertSameSiteRequest();
    const userId = await requireUserId(context.supabaseToken);
    return next({ context: { userId } });
  });
