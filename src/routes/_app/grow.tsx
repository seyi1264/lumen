import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUDIENCE, PLATFORM_META } from "@/lib/studio/constants";
import { formatNumber } from "@/lib/studio/format";
import { compactInsightLine, pillarPerformance } from "@/lib/studio/insights";
import { useStudioStore } from "@/lib/studio/store";
import type { Platform } from "@/lib/studio/types";

export const Route = createFileRoute("/_app/grow")({
  component: GrowPage,
});

const PLAYBOOK = [
  {
    title: "One asset, four rooms",
    body: "The Thursday letter is the source. Cut a note for X the same morning. A LinkedIn version on Tuesday. A short for the desk on Friday. Do not start from zero.",
  },
  {
    title: "Protect the window",
    body: "X: Tue–Thu 8–10. LinkedIn: Tue–Wed 7–9. Letter: Thursday 7:00. If it misses the window, it waits. Random times train the room to ignore you.",
  },
  {
    title: "Ask smaller",
    body: "Replies beat link clicks on notes. Saves beat reach on Instagram. Memberships beat a splashy launch. Pick the action the piece can actually earn.",
  },
];

function GrowPage() {
  const posts = useStudioStore((s) => s.posts);
  const voice = useStudioStore((s) => s.voice);
  const setVoice = useStudioStore((s) => s.setVoice);
  const experiments = useStudioStore((s) => s.experiments);
  const setExperimentStatus = useStudioStore((s) => s.setExperimentStatus);
  const resetStudio = useStudioStore((s) => s.resetStudio);
  const duplicate = useStudioStore((s) => s.duplicateToPlatform);
  const navigate = useNavigate();
  const pillars = pillarPerformance(posts);
  const quiet = [...pillars].reverse().find((p) => p.n >= 0);
  const last = posts.find((p) => p.status === "published");

  return (
    <div>
      <PageHeader
        eyebrow="Grow"
        title="Compound, do not perform"
        description={compactInsightLine(posts)}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(AUDIENCE) as Platform[]).map((p) => (
          <Card key={p} className="p-4">
            <p className="text-xs tracking-wide text-muted">{PLATFORM_META[p].label}</p>
            <p className="mt-2 font-display text-2xl tabular">{formatNumber(AUDIENCE[p])}</p>
            <p className="mt-1 text-xs text-subtle">{PLATFORM_META[p].cadence}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-display text-2xl">This week's playbook</h2>
          <ol className="mt-4 space-y-5">
            {PLAYBOOK.map((item, i) => (
              <li key={item.title} className="flex gap-4">
                <span className="font-display text-2xl text-subtle tabular">{i + 1}</span>
                <div>
                  <p className="text-sm text-fg">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          {last && (
            <div className="mt-6 rounded-md bg-raised px-4 py-3">
              <p className="text-xs text-muted">Repurpose the last piece that worked</p>
              <p className="mt-1 text-sm text-fg">{last.title}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["x", "linkedin", "newsletter"] as Platform[]).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nid = duplicate(last.id, p);
                      void navigate({ to: "/create", search: { id: nid } });
                    }}
                  >
                    To {PLATFORM_META[p].label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-display text-2xl">Experiments</h2>
          <ul className="mt-4 space-y-4">
            {experiments.map((e) => (
              <li key={e.id} className="rounded-md bg-raised p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-fg">{e.title}</p>
                  <Badge
                    tone={e.status === "learned" ? "gain" : e.status === "running" ? "paper" : "muted"}
                  >
                    {e.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{e.hypothesis}</p>
                {e.result && <p className="mt-2 text-sm text-fg">{e.result}</p>}
                {e.status !== "learned" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() =>
                      setExperimentStatus(
                        e.id,
                        e.status === "queued" ? "running" : "learned",
                        e.status === "running" ? e.result || "Logged. Keep what saved; drop what asked too much." : e.result,
                      )
                    }
                  >
                    {e.status === "queued" ? "Start" : "Mark learned"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-2xl">Voice</h2>
        <p className="mt-1 text-sm text-muted">
          The editor reads this before it writes. Keep it strict.
          {quiet ? ` ${quiet.pillar} is the quietest pillar — feed it or retire it.` : ""}
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" className="mt-1.5" value={voice.name} onChange={(e) => setVoice({ name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="handle">Handle</Label>
            <Input id="handle" className="mt-1.5" value={voice.handle} onChange={(e) => setVoice({ handle: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="audience">Who is in the room</Label>
            <Textarea
              id="audience"
              className="mt-1.5 min-h-24 rounded-md bg-raised px-3 py-2 text-sm shadow-[var(--shadow-border)]"
              value={voice.audience}
              onChange={(e) => setVoice({ audience: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="tone">Tone</Label>
            <Textarea
              id="tone"
              className="mt-1.5 min-h-24 rounded-md bg-raised px-3 py-2 text-sm shadow-[var(--shadow-border)]"
              value={voice.tone}
              onChange={(e) => setVoice({ tone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="avoid">Never</Label>
            <Textarea
              id="avoid"
              className="mt-1.5 min-h-24 rounded-md bg-raised px-3 py-2 text-sm shadow-[var(--shadow-border)]"
              value={voice.avoid}
              onChange={(e) => setVoice({ avoid: e.target.value })}
            />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => resetStudio()}>
          Restore the demo desk
        </Button>
      </Card>
    </div>
  );
}
