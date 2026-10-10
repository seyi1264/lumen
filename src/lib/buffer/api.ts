import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ENDPOINT = "https://api.buffer.com";

type Gql = {
  data?: Record<string, unknown> | null;
  errors?: { message?: string }[];
};

async function bufferGql(apiKey: string, query: string, variables?: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });
  } catch {
    return { ok: false as const, error: "Could not reach Buffer." };
  }

  const json = (await res.json().catch(() => null)) as Gql | null;
  if (!res.ok) {
    return { ok: false as const, error: `Buffer refused the key (${res.status}).` };
  }
  if (json?.errors?.length) {
    return {
      ok: false as const,
      error: json.errors.map((e) => e.message).filter(Boolean).join(" ") || "Buffer rejected the request.",
    };
  }
  return { ok: true as const, data: json?.data ?? {} };
}

const keySchema = z.string().trim().min(8).max(400);

export const loadBufferChannels = createServerFn({ method: "POST" })
  .validator(z.object({ apiKey: keySchema }))
  .handler(async ({ data }) => {
    const account = await bufferGql(
      data.apiKey,
      `query {
        account {
          organizations { id name }
        }
      }`,
    );
    if (!account.ok) return account;
    const organizations = (
      (account.data.account as { organizations?: { id: string; name: string }[] } | null)?.organizations ??
      []
    );
    const org = organizations[0];
    if (!org) return { ok: false as const, error: "This Buffer account has no organization." };

    const channels = await bufferGql(
      data.apiKey,
      `query Channels($organizationId: String!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          service
        }
      }`,
      { organizationId: org.id },
    );
    if (!channels.ok) return channels;
    const list = (channels.data.channels as { id: string; name: string; service: string }[] | null) ?? [];
    return {
      ok: true as const,
      organization: org.name,
      channels: list.map((c) => ({ id: c.id, name: c.name, service: c.service })),
    };
  });

const postInput = z.object({
  apiKey: keySchema,
  channelId: z.string().min(4).max(80),
  text: z.string().min(1).max(8000),
  mode: z.enum(["shareNow", "addToQueue", "customScheduled"]),
  dueAt: z.string().optional(),
});

export const createBufferPost = createServerFn({ method: "POST" })
  .validator(postInput)
  .handler(async ({ data }) => {
    const result = await bufferGql(
      data.apiKey,
      `mutation Create($text: String!, $channelId: String!, $dueAt: DateTime) {
        createPost(input: {
          text: $text
          channelId: $channelId
          schedulingType: automatic
          mode: ${data.mode}
          dueAt: $dueAt
        }) {
          ... on PostActionSuccess { post { id status } }
          ... on MutationError { message }
        }
      }`,
      {
        text: data.text,
        channelId: data.channelId,
        dueAt: data.mode === "customScheduled" ? data.dueAt : null,
      },
    );
    if (!result.ok) return result;
    const payload = result.data.createPost as { post?: { id: string; status?: string }; message?: string } | null;
    if (payload?.message) return { ok: false as const, error: payload.message };
    if (!payload?.post?.id) return { ok: false as const, error: "Buffer did not return a post." };
    return { ok: true as const, id: payload.post.id, status: payload.post.status ?? "queued" };
  });
