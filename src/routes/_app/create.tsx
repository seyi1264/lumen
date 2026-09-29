import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { formatISO } from "date-fns";
import { Loader2, Quote, Share2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/studio/page-header";
import { PlatformChip } from "@/components/studio/platform-chip";
import { ScoreRing } from "@/components/studio/score-ring";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateDraft, reshapeCopy } from "@/lib/studio/ai";
import { PLATFORM_META } from "@/lib/studio/constants";
import { STUDIO_NOW } from "@/lib/studio/seed";
import { scoreDraft } from "@/lib/studio/score";
import { useStudioStore } from "@/lib/studio/store";
import { PILLARS, PLATFORMS, type Pillar, type Post } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

type Search = { id?: string };

export const Route = createFileRoute("/_app/create")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: CreatePage,
});

function emptyPost(): Post {
  const now = formatISO(STUDIO_NOW);
  return {
    id: "draft-new",
    title: "",
    body: "",
    platform: "x",
    status: "draft",
    scheduledAt: null,
    publishedAt: null,
    tags: [],
    pillar: "Craft",
    cta: "",
    metrics: null,
    createdAt: now,
    updatedAt: now,
  };
}

function CreatePage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const posts = useStudioStore((s) => s.posts);
  const voice = useStudioStore((s) => s.voice);
  const upsert = useStudioStore((s) => s.upsertPost);
  const remove = useStudioStore((s) => s.deletePost);
  const publish = useStudioStore((s) => s.publishPost);
  const existing = posts.find((p) => p.id === id);

  const [draft, setDraft] = useState<Post>(() => existing ?? emptyPost());
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [hooks, setHooks] = useState<string[]>([]);

  useEffect(() => {
    if (existing) {
      setDraft(existing);
      setWhen(existing.scheduledAt ? existing.scheduledAt.slice(0, 16) : "");
      setNote("");
      setHooks([]);
    } else if (!id) {
      setDraft(emptyPost());
      setWhen("");
      setNote("");
      setHooks([]);
    }
  }, [existing, id]);

  const recentBodies = useMemo(
    () => posts.filter((p) => p.id !== draft.id).map((p) => p.body),
    [posts, draft.id],
  );
  const scored = scoreDraft({
    body: draft.body,
    platform: draft.platform,
    cta: draft.cta,
    pillar: draft.pillar,
    recentBodies,
  });

  function patch(p: Partial<Post>) {
    setDraft((d) => ({ ...d, ...p, updatedAt: formatISO(new Date()) }));
  }

  function save(status: Post["status"] = draft.status) {
    const id = draft.id === "draft-new" ? crypto.randomUUID() : draft.id;
    const next: Post = {
      ...draft,
      id,
      title: draft.title.trim() || draft.body.trim().slice(0, 48) || "Untitled",
      status,
      scheduledAt:
        status === "scheduled" && when
          ? new Date(when).toISOString()
          : status === "scheduled"
            ? draft.scheduledAt
            : draft.scheduledAt,
      createdAt: draft.id === "draft-new" ? formatISO(new Date()) : draft.createdAt,
      updatedAt: formatISO(new Date()),
    };
    upsert(next);
    setDraft(next);
    void navigate({ to: "/create", search: { id: next.id } });
    return next;
  }

  async function runDraft() {
    setBusy("draft");
    try {
      const res = await generateDraft({
        data: {
          brief,
          platform: draft.platform,
          pillar: draft.pillar,
          voice,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      patch({
        title: res.title,
        body: res.body,
        cta: res.cta,
        tags: res.tags,
      });
      setNote(res.note);
      setOpen(false);
      toast("Draft on the desk.");
    } finally {
      setBusy(null);
    }
  }

  async function runReshape(mode: "tighten" | "hooks" | "thread" | "repurpose") {
    if (!draft.body.trim()) {
      toast.error("Write a few lines first.");
      return;
    }
    setBusy(mode);
    try {
      const res = await reshapeCopy({
        data: {
          body: draft.body,
          platform: draft.platform,
          mode,
          voice,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      patch({ body: res.body || draft.body });
      setHooks(res.variants);
      setNote(res.note);
      toast("Editor returned.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Create"
        title={existing ? "On the desk" : "A clean page"}
        description="Write as if one person is reading. The editor on the right will tell you if the line is carrying its weight."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Quote className="size-4" />
                Ask the editor
              </Button>
            </DialogTrigger>
            <DialogContent title="Brief the editor">
              <p className="mb-4 text-sm text-muted">
                One sentence is enough. Platform and pillar are already set.
              </p>
              <Label htmlFor="brief">What is the piece about?</Label>
              <Textarea
                id="brief"
                className="mt-2 min-h-28 rounded-md bg-raised px-3 py-2 text-sm shadow-[var(--shadow-border)]"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="A note on why closed DMs made the work heavier in the right way."
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={runDraft} disabled={!!busy || brief.trim().length < 3}>
                  {busy === "draft" && <Loader2 className="size-4 animate-spin" />}
                  Write it
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lumen-enter p-5 md:p-8 lg:col-span-3">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <PlatformChip
                key={p}
                platform={p}
                active={draft.platform === p}
                onClick={() => patch({ platform: p })}
              />
            ))}
          </div>

          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Title — private, for the desk"
            className="mt-6 w-full bg-transparent font-display text-3xl tracking-tight text-fg placeholder:text-subtle focus-visible:outline-none md:text-4xl"
          />

          <Textarea
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="The first sentence should be able to stand in a room alone."
            className="mt-4 min-h-72 font-display text-lg leading-relaxed md:min-h-80 md:text-xl"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cta">Close</Label>
              <Input
                id="cta"
                className="mt-1.5"
                value={draft.cta}
                onChange={(e) => patch({ cta: e.target.value })}
                placeholder="A reply, a save, a click"
              />
            </div>
            <div>
              <Label>Pillar</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PILLARS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch({ pillar: p as Pillar })}
                    className={cn(
                      "h-9 rounded-full px-3 text-xs font-medium",
                      draft.pillar === p
                        ? "bg-primary text-primary-fg"
                        : "bg-raised text-muted hover:text-fg",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-border/80 pt-5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Label htmlFor="when" className="shrink-0">
                Schedule
              </Label>
              <Input
                id="when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  save("draft");
                  toast("Saved to drafts.");
                }}
              >
                Save draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!when) {
                    toast.error("Pick a time first.");
                    return;
                  }
                  save("scheduled");
                  toast("Placed on the calendar.");
                }}
              >
                Schedule
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const next = save("published");
                  publish(next.id);
                  toast("Published.");
                }}
              >
                Publish
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = save("draft");
                  void navigate({ to: "/channels", search: { id: next.id } });
                }}
              >
                <Share2 className="size-4" />
                Send to rooms
              </Button>
              {existing && (
                <Button
                  variant="danger"
                  size="icon-sm"
                  aria-label="Delete"
                  onClick={() => {
                    remove(draft.id);
                    void navigate({ to: "/create", search: {} });
                    setDraft(emptyPost());
                    toast("Removed from the desk.");
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <aside className="lg:col-span-2">
          <Card className="lumen-enter lumen-enter-2">
            <div className="flex items-center gap-4">
              <ScoreRing score={scored.score} />
              <div>
                <p className="text-xs font-medium tracking-wide text-muted">Desk score</p>
                <p className="mt-1 font-display text-2xl">
                  {scored.chars}
                  <span className="ml-1 text-base text-muted">
                    / {PLATFORM_META[draft.platform].limit}
                  </span>
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {scored.notes.map((n) => (
                <li key={n.text} className="flex gap-2 text-sm leading-relaxed">
                  <span
                    className={cn(
                      "mt-2 size-1.5 shrink-0 rounded-full",
                      n.tone === "up" && "bg-gain",
                      n.tone === "down" && "bg-loss",
                      n.tone === "neutral" && "bg-subtle",
                    )}
                  />
                  <span className={n.tone === "down" ? "text-fg" : "text-muted"}>{n.text}</span>
                </li>
              ))}
            </ul>
            {note && (
              <p className="mt-5 rounded-md bg-raised px-3 py-2 text-sm leading-relaxed text-fg">
                {note}
              </p>
            )}
          </Card>

          <Card className="mt-4">
            <p className="text-xs font-medium tracking-wide text-muted">Editor passes</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ["tighten", "Tighten"],
                  ["hooks", "Openings"],
                  ["thread", "Thread"],
                  ["repurpose", "Repurpose"],
                ] as const
              ).map(([mode, label]) => (
                <Button
                  key={mode}
                  variant="subtle"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => runReshape(mode)}
                >
                  {busy === mode && <Loader2 className="size-4 animate-spin" />}
                  {label}
                </Button>
              ))}
            </div>
            {hooks.length > 0 && (
              <ul className="mt-4 space-y-2">
                {hooks.map((h) => (
                  <li key={h}>
                    <button
                      type="button"
                      onClick={() => {
                        const rest = draft.body.split("\n").slice(1).join("\n");
                        patch({ body: rest ? `${h}\n${rest}` : h });
                      }}
                      className="w-full rounded-md bg-raised px-3 py-2 text-left text-sm text-fg hover:bg-surface"
                    >
                      {h}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
