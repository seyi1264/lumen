import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  callTool,
  ConnectorType,
  GoogleCalendarTools,
  GoogleDriveTools,
} from "@/lib/app-data/client.server";
import { authMiddleware } from "@/lib/auth/middleware";
import { dbSource, getSql } from "@/lib/db";
import { bufferGraphql, decryptBufferApiKey, encryptBufferApiKey } from "./buffer.server";

export type WorkspaceSignal = {
  id: string;
  title: string;
  source: "calendar" | "drive";
  summary: string;
  when: string | null;
  url?: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AutopilotMetadata = Record<string, JsonValue>;

export type AutopilotJob = {
  id: string;
  title: string;
  platform: string;
  status: string;
  scheduledFor: string | null;
  body: string;
  metadata: AutopilotMetadata;
  createdAt: string;
  updatedAt: string;
};

function parseMetadata(value: AutopilotMetadata | string | null): AutopilotMetadata {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value) as AutopilotMetadata;
  } catch {
    return {};
  }
}

const jobInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  platform: z.enum(["x", "linkedin", "facebook", "instagram", "youtube"]),
  status: z.enum(["queued", "scheduled", "published", "draft"]).default("queued"),
  scheduledFor: z.string().nullable().optional(),
  body: z.string().max(8000).default(""),
  metadata: z
    .object({
      sourceId: z.string().max(100).optional(),
      bufferPostId: z.string().max(200).optional(),
      brief: z.string().max(800).optional(),
      voice: z.object({ name: z.string(), audience: z.string(), tone: z.string(), avoid: z.string() }).optional(),
      tags: z.array(z.string().max(80)).max(5).optional(),
      cta: z.string().max(500).optional(),
      source: z.literal("autopilot").optional(),
    })
    .default({}),
});

const bufferApiKeyInput = z.object({ apiKey: z.string().trim().min(12).max(500) });
const bufferScheduleInput = z.object({
  channelId: z.string().min(1).max(200),
  text: z.string().trim().min(1).max(8000),
  scheduledFor: z.string().datetime().nullable().optional(),
});

type BufferOrganization = { id: string; name: string };
export type BufferChannel = {
  id: string;
  name: string;
  service: string;
  organizationId: string;
  organizationName: string;
};

export type BufferMetric = { type: string; name: string; value: number; unit: string };
export type BufferOrganizationInsights = {
  organizationId: string;
  organizationName: string;
  metrics: BufferMetric[];
  metricsUpdatedAt: string | null;
};

async function readBufferOrganizations(apiKey: string): Promise<BufferOrganization[]> {
  const data = await bufferGraphql<{ account: { organizations: BufferOrganization[] } }>(
    apiKey,
    "query { account { organizations { id name } } }",
  );
  return data.account.organizations;
}

async function readBufferChannels(apiKey: string): Promise<BufferChannel[]> {
  const organizations = await readBufferOrganizations(apiKey);
  const channelGroups = await Promise.all(
    organizations.map(async (organization) => {
      const channelsData = await bufferGraphql<{
        channels: Array<{ id: string; name: string; service: string }>;
      }>(
        apiKey,
        "query Channels($input: ChannelsInput!) { channels(input: $input) { id name service } }",
        { input: { organizationId: organization.id } },
      );
      return channelsData.channels.map((channel) => ({
        ...channel,
        organizationId: organization.id,
        organizationName: organization.name,
      }));
    }),
  );
  return channelGroups.flat();
}

export const getBufferInsights = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<
    | { ok: true; connected: false; organizations: [] }
    | { ok: true; connected: true; organizations: BufferOrganizationInsights[] }
    | { ok: false; error: string }
  > => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ api_key_ciphertext: string }>(
        "select api_key_ciphertext from buffer_connections where user_id = $1",
        [context.userId],
      );
      if (!rows[0]) return { ok: true, connected: false, organizations: [] };

      const apiKey = decryptBufferApiKey(context.userId, rows[0].api_key_ciphertext);
      const organizations = await readBufferOrganizations(apiKey);
      const endDateTime = new Date();
      const startDateTime = new Date(endDateTime.getTime() - 30 * 24 * 60 * 60 * 1000);
      const reports = await Promise.all(
        organizations.map(async (organization) => {
          const report = await bufferGraphql<{
            aggregatedPostMetrics: {
              metrics: BufferMetric[];
              metricsUpdatedAt: string | null;
            };
          }>(
            apiKey,
            `query Insights($input: AggregatedPostMetricsInput!) {
              aggregatedPostMetrics(input: $input) {
                metrics { type name value unit }
                metricsUpdatedAt
              }
            }`,
            {
              input: {
                organizationId: organization.id,
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
              },
            },
          );
          return {
            organizationId: organization.id,
            organizationName: organization.name,
            metrics: report.aggregatedPostMetrics.metrics,
            metricsUpdatedAt: report.aggregatedPostMetrics.metricsUpdatedAt,
          };
        }),
      );
      return { ok: true, connected: true, organizations: reports };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not load Buffer insights." };
    }
  });

export const getBufferChannels = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<
    | { ok: true; connected: false; channels: [] }
    | { ok: true; connected: true; channels: BufferChannel[] }
    | { ok: false; error: string }
  > => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ api_key_ciphertext: string }>(
        "select api_key_ciphertext from buffer_connections where user_id = $1",
        [context.userId],
      );
      const connection = rows[0];
      if (!connection) return { ok: true, connected: false, channels: [] };
      const apiKey = decryptBufferApiKey(context.userId, connection.api_key_ciphertext);
      return { ok: true, connected: true, channels: await readBufferChannels(apiKey) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not load Buffer channels." };
    }
  });

export const connectBuffer = createServerFn({ method: "POST" })
  .validator(bufferApiKeyInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<
    | { ok: true; channels: BufferChannel[] }
    | { ok: false; error: string }
  > => {
    try {
      const channels = await readBufferChannels(data.apiKey);
      const encryptedKey = encryptBufferApiKey(context.userId, data.apiKey);
      const sql = await getSql();
      await sql.query(
        `insert into buffer_connections (user_id, api_key_ciphertext, connected_at, updated_at)
         values ($1, $2, now(), now())
         on conflict (user_id) do update set
           api_key_ciphertext = excluded.api_key_ciphertext,
           connected_at = now(),
           updated_at = now()`,
        [context.userId, encryptedKey],
      );
      return { ok: true, channels };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not connect Buffer." };
    }
  });

export const disconnectBuffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      await sql.query("delete from buffer_connections where user_id = $1", [context.userId]);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not disconnect Buffer." };
    }
  });

export const scheduleBufferPost = createServerFn({ method: "POST" })
  .validator(bufferScheduleInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<
    | { ok: true; postId: string; dueAt: string | null }
    | { ok: false; error: string }
  > => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ api_key_ciphertext: string }>(
        "select api_key_ciphertext from buffer_connections where user_id = $1",
        [context.userId],
      );
      if (!rows[0]) return { ok: false, error: "Connect Buffer before scheduling posts." };

      const apiKey = decryptBufferApiKey(context.userId, rows[0].api_key_ciphertext);
      const result = await bufferGraphql<{
        createPost: { post?: { id: string; dueAt: string | null } | null; message?: string };
      }>(
        apiKey,
        `mutation SchedulePost($input: CreatePostInput!) {
          createPost(input: $input) {
            ... on PostActionSuccess { post { id dueAt } }
            ... on MutationError { message }
          }
        }`,
        {
          input: {
            text: data.text,
            channelId: data.channelId,
            schedulingType: "automatic",
            ...(data.scheduledFor
              ? { mode: "customScheduled", dueAt: data.scheduledFor }
              : { mode: "addToQueue" }),
          },
        },
      );
      const post = result.createPost.post;
      if (!post) return { ok: false, error: result.createPost.message ?? "Buffer did not accept this post." };
      return { ok: true, postId: post.id, dueAt: post.dueAt };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not schedule post with Buffer." };
    }
  });

export const readWorkspaceSignals = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; signals: WorkspaceSignal[] } | { ok: false; error: string }> => {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    const calendarResult = await callTool(
      GoogleCalendarTools.search,
      {
        q: "content|launch|campaign|CRM|sales|brief|revenue|pipeline",
        timeMin,
        timeMax,
        maxResults: 5,
      },
      { connectorType: ConnectorType.GoogleCalendar },
    );

    const driveResult = await callTool(
      GoogleDriveTools.search,
      {
        q: '"content" OR "campaign" OR "sales" OR "CRM" OR "pipeline" OR "brief"',
        pageSize: 5,
      },
      { connectorType: ConnectorType.GoogleDrive },
    );

    const calendarItems = Array.isArray((calendarResult.data as { items?: unknown[] } | null)?.items)
      ? ((calendarResult.data as { items: Array<Record<string, unknown>> }).items ?? [])
      : [];

    const driveItems = Array.isArray((driveResult.data as { files?: unknown[] } | null)?.files)
      ? ((driveResult.data as { files: Array<Record<string, unknown>> }).files ?? [])
      : [];

    const signals: WorkspaceSignal[] = [
      ...calendarItems.map((item, idx) => ({
        id: `cal-${idx}-${String(item.id ?? item.summary ?? "event")}`,
        title: String(item.summary ?? "Calendar signal"),
        source: "calendar" as const,
        summary: String(item.description ?? "Upcoming operational activity from Google Calendar."),
        when: typeof item.start === "string" ? item.start : (item.start as { dateTime?: string } | null)?.dateTime ?? null,
        url: typeof item.htmlLink === "string" ? item.htmlLink : undefined,
      })),
      ...driveItems.map((item, idx) => ({
        id: `drv-${idx}-${String(item.id ?? item.name ?? "drive")}`,
        title: String(item.name ?? "Drive brief"),
        source: "drive" as const,
        summary: String(item.description ?? item.webViewLink ?? "Shared document in Google Drive."),
        when: null,
        url: typeof item.webViewLink === "string" ? item.webViewLink : undefined,
      })),
    ].slice(0, 8);

    if (signals.length > 0) {
      return { ok: true, signals };
    }

    if (!calendarResult.ok && !driveResult.ok) {
      return {
        ok: false,
        error: calendarResult.errorMessage ?? driveResult.errorMessage ?? "No real data is connected yet.",
      };
    }

    return { ok: true, signals: [] };
  },
);

export const listAutopilotJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(
  async ({ context }): Promise<
    | { ok: true; jobs: AutopilotJob[]; storageIsTemporary: boolean }
    | { ok: false; error: string }
  > => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{
        id: string;
        title: string;
        platform: string;
        status: string;
        scheduled_for: string | null;
        body: string;
        metadata: AutopilotMetadata | string | null;
        created_at: string;
        updated_at: string;
      }>(
        "select id, title, platform, status, scheduled_for, body, metadata, created_at, updated_at from autopilot_jobs where user_id = $1 order by coalesce(scheduled_for, created_at) desc",
        [context.userId],
      );

      return {
        ok: true,
        storageIsTemporary: dbSource === "pglite",
        jobs: rows.map((row) => ({
          id: row.id,
          title: row.title,
          platform: row.platform,
          status: row.status,
          scheduledFor: row.scheduled_for,
          body: row.body,
          metadata: parseMetadata(row.metadata),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load scheduler jobs.",
      };
    }
  },
);

export const saveAutopilotJob = createServerFn({ method: "POST" })
  .validator(jobInput)
  .middleware([authMiddleware])
  .handler(
    async ({ context, data }): Promise<{ ok: true; job: AutopilotJob } | { ok: false; error: string }> => {
      try {
        const sql = await getSql();
        const id = data.id ?? crypto.randomUUID();
        const scheduledFor = data.scheduledFor ?? null;
        const metadata = JSON.stringify(data.metadata ?? {});

        await sql.query(
          `insert into autopilot_jobs (id, user_id, title, platform, status, scheduled_for, body, metadata, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
           on conflict (id) do update set
             title = excluded.title,
             platform = excluded.platform,
             status = excluded.status,
             scheduled_for = excluded.scheduled_for,
             body = excluded.body,
             metadata = excluded.metadata,
             updated_at = now()
           where autopilot_jobs.user_id = excluded.user_id`,
          [id, context.userId, data.title, data.platform, data.status, scheduledFor, data.body, metadata],
        );

        const rows = await sql.query<{
          id: string;
          title: string;
          platform: string;
          status: string;
          scheduled_for: string | null;
          body: string;
          metadata: AutopilotMetadata | string | null;
          created_at: string;
          updated_at: string;
        }>(
          "select id, title, platform, status, scheduled_for, body, metadata, created_at, updated_at from autopilot_jobs where id = $1 and user_id = $2",
          [id, context.userId],
        );

        const row = rows[0];
        if (!row) {
          throw new Error("Scheduler write succeeded but no row was returned.");
        }

        return {
          ok: true,
          job: {
            id: row.id,
            title: row.title,
            platform: row.platform,
            status: row.status,
            scheduledFor: row.scheduled_for,
            body: row.body,
            metadata: parseMetadata(row.metadata),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to save scheduler job.",
        };
      }
    },
  );
