import { createFileRoute } from "@tanstack/react-router";
import { formatISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, Tooltip, XAxis } from "recharts";
import { ChartFrame } from "@/components/studio/chart-frame";
import { Kpi } from "@/components/studio/kpi";
import { PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reshapeCopy } from "@/lib/studio/ai";
import { AUDIENCE_TOTAL, DEAL_TYPE_LABEL } from "@/lib/studio/constants";
import { formatCurrency } from "@/lib/studio/format";
import { revenueTotals, suggestedRate } from "@/lib/studio/insights";
import { useStudioStore } from "@/lib/studio/store";
import {
  DEAL_STATUSES,
  DEAL_TYPES,
  type Deal,
  type DealStatus,
  type DealType,
} from "@/lib/studio/types";

export const Route = createFileRoute("/_app/monetize")({
  component: MonetizePage,
});

function MonetizePage() {
  const deals = useStudioStore((s) => s.deals);
  const posts = useStudioStore((s) => s.posts);
  const stats = useStudioStore((s) => s.stats);
  const voice = useStudioStore((s) => s.voice);
  const addDeal = useStudioStore((s) => s.addDeal);
  const updateDeal = useStudioStore((s) => s.updateDeal);
  const { paid, pipeline, active, open } = revenueTotals(deals);
  const avgImp =
    stats.slice(-30).reduce((a, s) => a + s.impressions, 0) / Math.max(1, Math.min(30, stats.length));
  const rate = suggestedRate(avgImp, 6.2);

  const [openForm, setOpenForm] = useState(false);
  const [brand, setBrand] = useState("");
  const [amount, setAmount] = useState("3500");
  const [type, setType] = useState<DealType>("sponsorship");
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);

  const byType = DEAL_TYPES.map((t) => ({
    type: DEAL_TYPE_LABEL[t],
    amount: deals.filter((d) => d.type === t && d.status === "paid").reduce((a, d) => a + d.amount, 0),
  }));

  function add() {
    const deal: Deal = {
      id: crypto.randomUUID(),
      brand: brand.trim() || "Untitled",
      type,
      amount: Number(amount) || 0,
      status: "pipeline",
      dueAt: formatISO(new Date()),
      notes: "",
    };
    addDeal(deal);
    setBrand("");
    setOpenForm(false);
    toast("In the pipeline.");
  }

  async function writePitch() {
    setBusy(true);
    try {
      const sample = posts.find((p) => p.platform === "newsletter")?.body ?? voice.audience;
      const res = await reshapeCopy({
        data: {
          body: sample,
          platform: "newsletter",
          mode: "pitch",
          voice,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPitch(res.body);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Monetize"
        title="The rate holds"
        description={`A room of ${AUDIENCE_TOTAL.toLocaleString()} is not a media kit. It is a list of people who already chose to stay. Price like that.`}
        action={
          <Dialog open={openForm} onOpenChange={setOpenForm}>
            <DialogTrigger asChild>
              <Button>Add deal</Button>
            </DialogTrigger>
            <DialogContent title="New deal">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" className="mt-1.5" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    className="mt-1.5"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {DEAL_TYPES.map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={type === t ? "primary" : "subtle"}
                        onClick={() => setType(t)}
                      >
                        {DEAL_TYPE_LABEL[t]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setOpenForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={add}>Add to pipeline</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Collected" value={formatCurrency(paid)} hint="this cycle" />
        <Kpi label="Active" value={formatCurrency(active)} hint="in flight" />
        <Kpi label="Pipeline" value={formatCurrency(pipeline)} hint="not yet yes" />
        <Kpi label="Suggested letter rate" value={formatCurrency(rate.letter)} hint={`~$${rate.rpm.toFixed(0)} RPM`} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-display text-2xl">Mix</h2>
          <div className="mt-4">
            <ChartFrame height={200}>
              <BarChart data={byType} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="type" tick={{ fill: "var(--color-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="rounded-md bg-surface px-3 py-2 text-xs shadow-[var(--shadow-border)]">
                        {formatCurrency(Number(payload[0].value))}
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartFrame>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-subtle uppercase">
                <tr className="border-b border-border/80">
                  <th className="py-2 font-medium">Brand</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="text-fg">{d.brand}</p>
                      <p className="text-xs text-muted">{d.notes}</p>
                    </td>
                    <td className="py-3 pr-3 text-muted">{DEAL_TYPE_LABEL[d.type]}</td>
                    <td className="py-3 pr-3 tabular">{formatCurrency(d.amount)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {DEAL_STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateDeal(d.id, { status: s as DealStatus })}
                          >
                            <Badge tone={d.status === s ? (s === "paid" ? "gain" : "paper") : "muted"}>
                              {s}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-display text-2xl">The note</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Three lines beat a kit: who is in the room, what a letter does, what you will not do. Open is{" "}
            {formatCurrency(open)}.
          </p>
          <Button variant="outline" className="mt-4" onClick={writePitch} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Draft a pitch
          </Button>
          {pitch && (
            <p className="mt-4 whitespace-pre-wrap rounded-md bg-raised px-3 py-3 text-sm leading-relaxed text-fg">
              {pitch}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
