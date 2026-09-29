import { createFileRoute, Link } from "@tanstack/react-router";
import { formatISO } from "date-fns";
import { Bot, CalendarClock, MessageSquareReply, Rocket, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateDraft, reshapeCopy } from "@/lib/studio/ai";
import {
  getBufferChannels,
  getBufferInsights,
  listAutopilotJobs,
  readWorkspaceSignals,
  saveAutopilotJob,
  scheduleBufferPost,
  type AutopilotJob,
  type BufferChannel,
  type BufferOrganizationInsights,
  type WorkspaceSignal,
} from "@/lib/studio/backend";
import { PLATFORM_META } from "@/lib/studio/constants";
import { formatWhen } from "@/lib/studio/format";
import { useStudioStore } from "@/lib/studio/store";
import type { Platform, Post } from "@/lib/studio/types";
import { adaptCopy } from "@/lib/studio/channels";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/autopilot")({
  component: AutopilotPage,
});

type SchedulerPlatform = "x" | "linkedin" | "facebook" | "instagram" | "youtube";

function schedulerPlatform(service: string): SchedulerPlatform | null {
  switch (service.toLowerCase()) {
    case "twitter":
    case "x":
      return "x";
    case "linkedin":
      return "linkedin";
    case "facebook":
      return "facebook";
    case "instagram":
      return "instagram";
    case "youtube":
      return "youtube";
    default:
      return null;
  }
}

function AutopilotPage() {
  const posts = useStudioStore((s) => s.posts);
  const voice = useStudioStore((s) => s.voice);
  const upsert = useStudioStore((s) => s.upsertPost);

  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<"draft" | "queue" | "reply" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyPool, setReplyPool] = useState<string[]>([]);
  const [workspaceSignals, setWorkspaceSignals] = useState<WorkspaceSignal[]>([]);
  const [schedulerJobs, setSchedulerJobs] = useState<AutopilotJob[]>([]);
  const [schedulerStorageIsTemporary, setSchedulerStorageIsTemporary] = useState(false);
  const [bufferChannels, setBufferChannels] = useState<BufferChannel[]>([]);
  const [selectedBufferChannelIds, setSelectedBufferChannelIds] = useState<string[]>([]);
  const [bufferConnected, setBufferConnected] = useState(false);
  const [bufferError, setBufferError] = useState<string | null>(null);
  const [bufferInsights, setBufferInsights] = useState<BufferOrganizationInsights[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const signalsResult = await readWorkspaceSignals();
        if (signalsResult.ok) {
          setWorkspaceSignals(signalsResult.signals);
        } else {
          setWorkspaceError(signalsResult.error);
        }
      } catch (error) {
        setWorkspaceError(error instanceof Error ? error.message : "Workspace signals are unavailable.");
      }

      const jobsResult = await listAutopilotJobs().catch(() => ({
        ok: false as const,
        error: "A signed-in workspace identity is required to access your scheduler.",
      }));
      if (jobsResult.ok) {
        setSchedulerJobs(jobsResult.jobs);
        setSchedulerStorageIsTemporary(jobsResult.storageIsTemporary);
      } else {
        setSchedulerError(jobsResult.error);
      }

      const bufferResult = await getBufferChannels().catch(() => ({
        ok: false as const,
        error: "Connect Buffer from Channels to load your publishing destinations.",
      }));
      if (bufferResult.ok) {
        setBufferConnected(bufferResult.connected);
        setBufferChannels(bufferResult.channels);
      } else {
        setBufferError(bufferResult.error);
      }

      const insightsResult = await getBufferInsights().catch(() => ({
        ok: false as const,
        error: "Buffer analytics are unavailable.",
      }));
      if (insightsResult.ok && insightsResult.connected) {
        setBufferInsights(insightsResult.organizations);
      }
    })();
  }, []);

  const queue = useMemo(() => {
    const fromScheduler = schedulerJobs.map((job) => {
      const sourceId = typeof job.metadata.sourceId === "string" ? job.metadata.sourceId : job.id;
      const sourcePost = posts.find((post) => post.id === sourceId);
      return {
        id: job.id,
        title: sourcePost?.title ?? job.title,
        body: sourcePost?.body ?? job.body,
        platform: job.platform as Platform,
        status: job.status,
        scheduledAt: job.scheduledFor,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    });

    return fromScheduler
      .filter((job) => job.status === "draft" || job.status === "scheduled" || job.status === "queued")
      .slice(0, 4);
  }, [posts, schedulerJobs]);

  function toggleBufferChannel(id: string) {
    setSelectedBufferChannelIds((current) =>
      current.includes(id) ? current.filter((channelId) => channelId !== id) : [...current, id],
    );
  }

  async function handleGenerate() {
    if (brief.trim().length < 3) {
      toast.error("Add a campaign brief before generating content.");
      return;
    }
    setBusy("draft");
    try {
      const liveContext = workspaceSignals
        .slice(0, 3)
        .map((signal) => `${signal.title}: ${signal.summary}`)
        .join("\n");
      const result = await generateDraft({
        data: {
          brief: `${brief.trim()}${liveContext ? `\n\nLive workspace context:\n${liveContext}` : ""}`.slice(0, 800),
          platform: "x",
          pillar: "Craft",
          voice,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const now = formatISO(new Date());
      const next: Post = {
        id: crypto.randomUUID(),
        title: result.title,
        body: result.body,
        platform: "x",
        status: "draft",
        scheduledAt: null,
        publishedAt: null,
        tags: result.tags,
        pillar: "Craft",
        cta: result.cta,
        metrics: null,
        createdAt: now,
        updatedAt: now,
      };
      const saved = await saveAutopilotJob({
        data: {
          id: next.id,
          title: result.title,
          platform: "x",
          status: "draft",
          body: result.body,
          metadata: { brief: brief.trim(), voice, tags: result.tags, cta: result.cta, source: "autopilot" },
        },
      });
      if (!saved.ok) {
        toast.error(`Draft created locally, but scheduler persistence failed: ${saved.error}`);
      }
      const jobsResult = await listAutopilotJobs();
      if (jobsResult.ok) {
        setSchedulerJobs(jobsResult.jobs);
        setSchedulerStorageIsTemporary(jobsResult.storageIsTemporary);
      }
      upsert(next);
      setActiveId(next.id);
      toast("AI draft created and parked on the desk.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace authentication is required.");
    } finally {
      setBusy(null);
    }
  }

  async function handleQueue() {
    const sourceId = activeId ?? queue.find((job) => job.status === "draft")?.id ?? null;
    if (!sourceId) {
      toast.error("Create a draft before queueing channels.");
      return;
    }
    const destinations = bufferChannels.filter((channel) => selectedBufferChannelIds.includes(channel.id));
    if (!bufferConnected || destinations.length === 0) {
      toast.error("Connect Buffer and select at least one channel.");
      return;
    }
    setBusy("queue");
    try {
      const sourcePost = posts.find((p) => p.id === sourceId);
      const sourceJob = schedulerJobs.find((job) => job.id === sourceId);
      const sourceTitle = sourcePost?.title ?? sourceJob?.title ?? "Scheduled content";
      const results = await Promise.all(
        destinations.map(async (channel) => {
          const platform = schedulerPlatform(channel.service);
          if (!platform) return { channel, platform, result: null, localSave: null };
          const text = sourcePost ? adaptCopy(sourcePost, platform) : sourceJob?.body ?? "";
          const result = await scheduleBufferPost({
            data: { channelId: channel.id, text },
          });
          const localSave = result.ok
            ? await saveAutopilotJob({
                data: {
                  id: `${sourceId}:${channel.id}`,
                  title: sourceTitle,
                  platform,
                  status: "scheduled",
                  scheduledFor: result.dueAt,
                  body: text,
                  metadata: { sourceId, bufferPostId: result.postId },
                },
              })
            : null;
          return { channel, platform, result, localSave };
        }),
      );

      const accepted = results.filter((entry) => entry.result?.ok);
      const rejectedErrors = results.flatMap((entry) =>
        entry.result && !entry.result.ok ? [entry.result.error] : [],
      );
      const unsupported = results.filter((entry) => !entry.platform);
      if (rejectedErrors.length > 0) {
        toast.error(rejectedErrors.join("; "));
      }
      if (unsupported.length > 0) {
        toast.error(`${unsupported.length} selected Buffer channel(s) are not supported here.`);
      }
      if (accepted.some((entry) => entry.localSave && !entry.localSave.ok)) {
        toast.error("Buffer scheduled the post, but Lumen could not save its local schedule record.");
      }
      const jobsResult = await listAutopilotJobs();
      if (jobsResult.ok) {
        setSchedulerJobs(jobsResult.jobs);
        setSchedulerStorageIsTemporary(jobsResult.storageIsTemporary);
      }
      if (accepted.length > 0) {
        toast(`Added ${accepted.length} post(s) to Buffer’s channel queues.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace authentication is required.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReplies() {
    if (!commentText.trim()) {
      toast.error("Paste a real comment before drafting a reply.");
      return;
    }
    setBusy("reply");
    try {
      const result = await reshapeCopy({
        data: { body: commentText.trim(), platform: "x", mode: "reply", voice },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReplyPool([result.body]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace authentication is required.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Autopilot"
        title="The growth brain"
        description="Draft from live workspace signals and save per-user schedules. Social publishing and analytics need authorized platform connections."
      />

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-fg">
              <Bot className="size-4 text-primary" />
              <h2 className="font-display text-2xl">AI command brief</h2>
            </div>
            <Badge tone="muted">{workspaceSignals.length} live signals</Badge>
          </div>

          <Label htmlFor="autopilot-brief">Campaign intent</Label>
          <Textarea
            id="autopilot-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the campaign, audience, and goal. Live workspace signals are added when available."
            className="mt-2 min-h-36 text-sm leading-relaxed"
          />

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <Label>Buffer destinations</Label>
              <Link to="/channels" className="text-xs text-primary underline-offset-4 hover:underline">
                Manage connection
              </Link>
            </div>
            {!bufferConnected ? (
              <p className="mt-2 text-sm text-muted">{bufferError ?? "Connect Buffer on Channels to load your accounts."}</p>
            ) : bufferChannels.filter((channel) => schedulerPlatform(channel.service)).length === 0 ? (
              <p className="mt-2 text-sm text-muted">No supported Buffer channels found.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {bufferChannels.filter((channel) => schedulerPlatform(channel.service)).map((channel) => (
                  <label key={channel.id} className="flex min-w-0 items-start gap-2 rounded-md border border-border/80 bg-surface p-3">
                    <input
                      type="checkbox"
                      checked={selectedBufferChannelIds.includes(channel.id)}
                      onChange={() => toggleBufferChannel(channel.id)}
                      className="mt-0.5 size-4 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-fg">{channel.name}</span>
                      <span className="block truncate text-xs text-muted">{channel.service} · {channel.organizationName}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-subtle">Buffer adds posts to each channel’s next available queue slot. Channels configured for notification publishing may still require a manual confirmation.</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={busy !== null}>
              <Sparkles className="size-4" />
              {busy === "draft" ? "Generating…" : "Generate post"}
            </Button>
            <Button variant="outline" onClick={handleQueue} disabled={busy !== null}>
              <CalendarClock className="size-4" />
              {busy === "queue" ? "Saving…" : "Save to schedule"}
            </Button>
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <div className="flex items-center gap-2 text-fg">
            <TrendingUp className="size-4 text-primary" />
            <h2 className="font-display text-2xl">Virality pulse</h2>
          </div>
          {bufferInsights.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {bufferConnected
                ? "Buffer has not returned analytics for this account yet. Metrics can take about a day to arrive after publishing."
                : "Connect Buffer on Channels to read real post metrics."}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {bufferInsights.map((report) => (
                <div key={report.organizationId} className="border-t border-border/80 pt-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-fg">{report.organizationName}</p>
                    <span className="text-xs text-subtle">
                      {report.metricsUpdatedAt
                        ? `Updated ${formatWhen(report.metricsUpdatedAt)}`
                        : "No update timestamp"}
                    </span>
                  </div>
                  {report.metrics.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">No metrics reported in the last 30 days.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {report.metrics.map((metric) => (
                        <div key={metric.type} className="rounded-md bg-raised p-3">
                          <p className="text-xs text-subtle">{metric.name}</p>
                          <p className="mt-1 text-lg text-fg">
                            {new Intl.NumberFormat().format(metric.value)}{metric.unit === "percentage" ? "%" : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {schedulerStorageIsTemporary && (
        <section className="mt-6">
          <Card className="p-4 text-sm text-muted">
            Scheduler storage is temporary in this preview. Deployment provisions Neon for durable, per-user jobs.
          </Card>
        </section>
      )}

      {workspaceSignals.length > 0 && (
        <section className="mt-6">
          <Card className="p-5 md:p-6">
            <div className="flex items-center gap-2 text-fg">
              <CalendarClock className="size-4 text-primary" />
              <h2 className="font-display text-2xl">Live workspace signals</h2>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {workspaceSignals.map((signal) => (
                <div key={signal.id} className="rounded-md border border-border/80 bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="muted">{signal.source}</Badge>
                    {signal.when && <span className="text-[10px] uppercase tracking-[0.12em] text-subtle">{formatWhen(signal.when)}</span>}
                  </div>
                  <p className="mt-2 text-sm font-medium text-fg">{signal.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{signal.summary}</p>
                  {signal.url && (
                    <a href={signal.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline">
                      Open source
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-4">
        {queue.map((post) => (
          <Card key={post.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="muted">{PLATFORM_META[post.platform].label}</Badge>
              {post.status === "scheduled" || post.status === "queued" ? <Badge tone="scheduled">Scheduled</Badge> : <Badge tone="draft">Draft</Badge>}
            </div>
            <p className="mt-3 text-sm font-medium text-fg">{post.title}</p>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{post.body}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-subtle">
              <span>{formatWhen(post.scheduledAt)}</span>
              <Link to="/create" search={{ id: post.id }} className="text-muted hover:text-fg">
                Edit
              </Link>
            </div>
          </Card>
        ))}
        {queue.length === 0 && (
          <Card className="p-4 text-sm text-muted lg:col-span-4">
            {schedulerError ?? "No persistent scheduler jobs yet."}
          </Card>
        )}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5 md:p-6">
          <div className="flex items-center gap-2 text-fg">
            <MessageSquareReply className="size-4 text-primary" />
            <h2 className="font-display text-2xl">Comment reply engine</h2>
          </div>
          <Label htmlFor="autopilot-comment" className="mt-4 block">Comment to answer</Label>
          <Textarea
            id="autopilot-comment"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Paste a real comment"
            className="mt-2 min-h-24 text-sm leading-relaxed"
          />
          <Button
            variant="outline"
            className="mt-3"
            onClick={handleReplies}
            disabled={busy !== null || !commentText.trim()}
          >
            <MessageSquareReply className="size-4" />
            {busy === "reply" ? "Drafting…" : "Draft reply"}
          </Button>
          {replyPool.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Replies are generated from the comment you provide. Publishing replies is not connected yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {replyPool.map((line, index) => (
                <li key={index} className="rounded-md bg-raised p-3 text-sm leading-relaxed text-fg">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 md:p-6">
          <div className="flex items-center gap-2 text-fg">
            <Rocket className="size-4 text-primary" />
            <h2 className="font-display text-2xl">Best next moves</h2>
          </div>
          <ul className="mt-4 space-y-3">
            <li className="text-sm text-muted">
              Social analytics are not connected. Live performance data will appear here when an analytics source is authorized.
            </li>
          </ul>
        </Card>
      </section>

      {workspaceSignals.length === 0 && (
        <section className="mt-6">
          <Card className="p-5 text-sm text-muted">
            {workspaceError ?? "No live calendar or Drive signals were returned by the connected sources."}
          </Card>
        </section>
      )}
    </div>
  );
}
