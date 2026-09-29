import { createFileRoute, Link } from "@tanstack/react-router";
import { formatISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/studio/page-header";
import { PlatformChip, PlatformMark } from "@/components/studio/platform-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHANNELS,
  adaptCopy,
  channelHealth,
  duePosts,
  handOffToChannel,
  upcomingQueue,
} from "@/lib/studio/channels";
import { PLATFORM_META } from "@/lib/studio/constants";
import { formatWhen } from "@/lib/studio/format";
import { useStudioStore } from "@/lib/studio/store";
import { PLATFORMS, type Platform, type Post } from "@/lib/studio/types";
import {
  connectBuffer,
  disconnectBuffer,
  getBufferChannels,
  type BufferChannel,
} from "@/lib/studio/backend";
import { cn } from "@/lib/utils";

type Search = { id?: string };

export const Route = createFileRoute("/_app/channels")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: ChannelsPage,
});

async function sendPiece(post: Post) {
  const text = adaptCopy(post, post.platform);
  const result = await handOffToChannel(post.platform, text, post.title);
  if (result.copied && result.opened) {
    toast(`Opened ${PLATFORM_META[post.platform].label}. Copy is on the clipboard.`);
  } else if (result.copied) {
    toast("Copied. Paste it into the composer that just tried to open.");
  } else if (result.opened) {
    toast(`Opened ${PLATFORM_META[post.platform].label}.`);
  } else {
    toast.error("The browser blocked the handoff. Copy the piece from the desk.");
  }
  return result.opened || result.copied;
}

function ChannelsPage() {
  const { id } = Route.useSearch();
  const posts = useStudioStore((s) => s.posts);
  const channels = useStudioStore((s) => s.channels);
  const setChannel = useStudioStore((s) => s.setChannel);
  const syndicatePost = useStudioStore((s) => s.syndicatePost);
  const publishPost = useStudioStore((s) => s.publishPost);
  const sources = useMemo(
    () =>
      posts.filter(
        (p) => p.status === "draft" || p.status === "scheduled" || p.status === "published",
      ),
    [posts],
  );
  const due = duePosts(posts);
  const upcoming = upcomingQueue(posts).slice(0, 6);
  const [sourceId, setSourceId] = useState(id ?? sources[0]?.id ?? "");
  const [rooms, setRooms] = useState<Platform[]>(["x", "linkedin", "facebook"]);
  const [when, setWhen] = useState("");
  const [bufferKey, setBufferKey] = useState("");
  const [bufferChannels, setBufferChannels] = useState<BufferChannel[]>([]);
  const [bufferConnected, setBufferConnected] = useState(false);
  const [bufferBusy, setBufferBusy] = useState(false);
  const [bufferError, setBufferError] = useState<string | null>(null);
  const source = posts.find((p) => p.id === sourceId) ?? sources[0];

  useEffect(() => {
    if (id) setSourceId(id);
  }, [id]);

  useEffect(() => {
    void getBufferChannels()
      .then((result) => {
        if (!result.ok) {
          setBufferError(result.error);
          return;
        }
        setBufferConnected(result.connected);
        setBufferChannels(result.channels);
      })
      .catch((error: unknown) => {
        setBufferError(error instanceof Error ? error.message : "Could not check Buffer connection.");
      });
  }, []);

  async function handleConnectBuffer() {
    if (!bufferKey.trim()) {
      toast.error("Enter your Buffer API key.");
      return;
    }
    setBufferBusy(true);
    try {
      const result = await connectBuffer({ data: { apiKey: bufferKey.trim() } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBufferChannels(result.channels);
      setBufferConnected(true);
      setBufferKey("");
      setBufferError(null);
      toast(`Buffer connected. ${result.channels.length} channels found.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect Buffer.");
    } finally {
      setBufferBusy(false);
    }
  }

  async function handleDisconnectBuffer() {
    setBufferBusy(true);
    try {
      const result = await disconnectBuffer();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBufferConnected(false);
      setBufferChannels([]);
      toast("Buffer disconnected from Lumen. Revoke the API key in Buffer settings to invalidate it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Buffer.");
    } finally {
      setBufferBusy(false);
    }
  }

  function toggleRoom(p: Platform) {
    setRooms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Channels"
        title="One idea, every room"
        description="Connect Buffer once, then schedule to the social channels already authorized in your Buffer account."
      />

      <Card className="mb-6 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">Buffer connection</h2>
            <p className="mt-1 text-sm text-muted">
              Your key is encrypted per user and sent only to Lumen’s server. Buffer keys can access all organizations on that Buffer account.
            </p>
          </div>
          {bufferConnected && <Badge tone="published">Connected · {bufferChannels.length} channels</Badge>}
        </div>

        {!bufferConnected ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="buffer-api-key">Buffer API key</Label>
                <a
                  href="https://publish.buffer.com/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Open Buffer API settings
                </a>
              </div>
              <Input
                id="buffer-api-key"
                type="password"
                autoComplete="off"
                value={bufferKey}
                onChange={(event) => setBufferKey(event.target.value)}
                placeholder="Create a key in Buffer Settings → API"
                className="mt-1.5"
              />
            </div>
            <Button onClick={handleConnectBuffer} disabled={bufferBusy || !bufferKey.trim()}>
              {bufferBusy ? "Connecting…" : "Connect Buffer"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleDisconnectBuffer} disabled={bufferBusy}>
              {bufferBusy ? "Disconnecting…" : "Disconnect Buffer"}
            </Button>
            <p className="text-xs text-subtle">Disconnect removes Lumen’s encrypted copy; revoke the key in Buffer to invalidate it.</p>
          </div>
        )}

        {bufferError && <p role="status" className="mt-3 text-sm text-muted">{bufferError}</p>}
        {bufferConnected && bufferChannels.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bufferChannels.map((channel) => (
              <li key={channel.id} className="rounded-md border border-border/80 bg-surface p-3">
                <p className="text-sm font-medium text-fg">{channel.name}</p>
                <p className="mt-1 text-xs text-muted">{channel.service} · {channel.organizationName}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-subtle">Buffer supports X, YouTube, LinkedIn, Facebook, and other listed channels; it does not provide Medium publishing or CRM access.</p>
      </Card>

      {due.length > 0 && (
        <Card className="mb-6">
          <h2 className="font-display text-2xl">Due now</h2>
          <p className="mt-1 text-sm text-muted">
            Send opens the network. Mark it published once the composer confirms.
          </p>
          <ul className="mt-4 space-y-3">
            {due.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-md bg-raised p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <PlatformMark platform={p.platform} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{p.title}</p>
                    <p className="text-xs text-muted">
                      {PLATFORM_META[p.platform].label} · {formatWhen(p.scheduledAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const ok = await sendPiece(p);
                      if (ok) publishPost(p.id);
                    }}
                  >
                    Send
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/create" search={{ id: p.id }}>
                      Edit
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const health = channelHealth(posts, p);
          const on = channels[p]?.enabled ?? true;
          return (
            <Card key={p} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-fg">{PLATFORM_META[p].label}</p>
                  <p className="mt-1 text-xs text-muted">{PLATFORM_META[p].cadence}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChannel(p, { enabled: !on })}
                  className={cn(
                    "h-11 rounded-full px-3 text-xs font-medium",
                    on ? "bg-primary text-primary-fg" : "bg-raised text-muted",
                  )}
                >
                  {on ? "On" : "Off"}
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">{CHANNELS[p].handoff}</p>
              <p className="mt-3 text-xs tabular text-subtle">
                {health.scheduled} queued · {health.drafts} on the desk · {PLATFORM_META[p].bestWindows}
              </p>
            </Card>
          );
        })}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-display text-2xl">Syndicate</h2>
          <p className="mt-1 text-sm text-muted">
            Pick a piece. Lumen writes a native version for each room you tick, then queues them together.
          </p>

          <div className="mt-5">
            <Label htmlFor="source">Source</Label>
            <select
              id="source"
              value={source?.id ?? ""}
              onChange={(e) => setSourceId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)] focus-visible:outline-none"
            >
              {sources.map((p) => (
                <option key={p.id} value={p.id}>
                  {PLATFORM_META[p.platform].label} — {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <Label>Rooms</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <PlatformChip
                  key={p}
                  platform={p}
                  active={rooms.includes(p)}
                  onClick={() => toggleRoom(p)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="sync-when">Shared slot (optional)</Label>
            <Input
              id="sync-when"
              type="datetime-local"
              className="mt-1.5"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>

          {source && rooms.length > 0 && (
            <ul className="mt-5 space-y-3">
              {rooms.map((room) => (
                <li key={room} className="rounded-md bg-raised p-3">
                  <p className="text-xs tracking-wide text-muted">{PLATFORM_META[room].label}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">
                    {adaptCopy(source, room)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!source || rooms.length === 0}
              onClick={() => {
                if (!source) return;
                const iso = when ? new Date(when).toISOString() : null;
                syndicatePost(source.id, rooms, iso);
                toast(
                  iso
                    ? `Queued ${rooms.length} rooms.`
                    : `Drafted ${rooms.length} native versions.`,
                );
              }}
            >
              Queue rooms
            </Button>
            <Button
              disabled={!source || rooms.length === 0}
              onClick={async () => {
                if (!source) return;
                const ids = syndicatePost(source.id, rooms, formatISO(new Date()));
                const created = useStudioStore
                  .getState()
                  .posts.filter((p) => ids.includes(p.id));
                for (const piece of created) {
                  await sendPiece(piece);
                  publishPost(piece.id);
                }
              }}
            >
              Send now
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-display text-2xl">Queue</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing waiting. Syndicate a piece, or place one on the calendar.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {upcoming.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/create"
                    search={{ id: p.id }}
                    className="flex gap-3 rounded-md p-2 hover:bg-raised"
                  >
                    <PlatformMark platform={p.platform} />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-fg">{p.title}</p>
                      <p className="text-xs text-muted">{formatWhen(p.scheduledAt)}</p>
                    </div>
                    <Badge tone="scheduled" className="ml-auto shrink-0">
                      {PLATFORM_META[p.platform].short}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
