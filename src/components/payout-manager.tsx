"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChevronDown } from "lucide-react";
import { processDuePayoutsAction } from "@/server/admin-actions";
import { formatINR } from "@/lib/money";
import { Badge, Button } from "@/components/ui";

type PayoutRecord = {
  id: string;
  date: string;
  memberId: string;
  memberName: string;
  gross: number;
  adminCharge: number;
  net: number;
  utr: string | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "ON_HOLD";
  onHoldReason: string | null;
  isDue: boolean;
};

const tone = { PAID: "success", PENDING: "warning", ON_HOLD: "danger", FAILED: "danger", PROCESSING: "warning" } as const;

function ProcessSelectedButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!count || pending} aria-busy={pending}>
      {pending ? "Processing selected…" : `Process Selected (${count})`}
    </Button>
  );
}

export function PayoutManager({ records }: { records: PayoutRecord[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, action] = useFormState(processDuePayoutsAction, undefined);
  const groups = useMemo(() => {
    const grouped = new Map<string, PayoutRecord[]>();
    for (const record of records) {
      const key = `${record.date}:${record.memberId}`;
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    }
    return Array.from(grouped.values());
  }, [records]);

  function toggle(ids: string[], checked: boolean) {
    setSelected((current) => checked
      ? Array.from(new Set([...current, ...ids]))
      : current.filter((id) => !ids.includes(id)));
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="selectedIds" value={selected.join(",")} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
        <div>
          <div className="text-sm font-medium">{selected.length} payout line(s) selected</div>
          <div className="text-xs text-muted-foreground">Select a due member group, then process its combined payout.</div>
        </div>
        <ProcessSelectedButton count={selected.length} />
      </div>
      {state?.error && <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</div>}
      {state?.success && <div className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{state.success}</div>}

      {groups.map((group) => {
        const first = group[0];
        const eligibleIds = group.filter((p) => p.status === "PENDING" && p.isDue).map((p) => p.id);
        const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.includes(id));
        const total = group.reduce((sum, p) => sum + p.net, 0);
        const paid = group.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.net, 0);
        const pending = group.filter((p) => p.status === "PENDING" || p.status === "PROCESSING").reduce((sum, p) => sum + p.net, 0);
        const held = group.filter((p) => p.status === "ON_HOLD").reduce((sum, p) => sum + p.net, 0);

        return (
          <details key={`${first.date}:${first.memberId}`} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <input
                type="checkbox"
                aria-label={`Select due payouts for ${first.memberId}`}
                checked={allSelected}
                disabled={!eligibleIds.length}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => toggle(eligibleIds, event.target.checked)}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--brand))]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{first.memberId} · {first.memberName}</span>
                  <span className="text-xs text-muted-foreground">{first.date}</span>
                  <Badge>{group.length} payout line(s)</Badge>
                </div>
                <div className="mt-2 grid gap-1 text-xs sm:grid-cols-4">
                  <span>Total <strong>{formatINR(total)}</strong></span>
                  <span className="text-success">Paid <strong>{formatINR(paid)}</strong></span>
                  <span className="text-warning">Pending <strong>{formatINR(pending)}</strong></span>
                  {held > 0 && <span className="text-danger">On hold <strong>{formatINR(held)}</strong></span>}
                </div>
              </div>
              <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t p-3">
              {group.map((p, index) => (
                <div key={p.id} className="grid gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-6">
                  <span><span className="text-muted-foreground">Line</span><br />#{index + 1}</span>
                  <span><span className="text-muted-foreground">Gross</span><br />{formatINR(p.gross)}</span>
                  <span><span className="text-muted-foreground">Admin 5%</span><br />{formatINR(p.adminCharge)}</span>
                  <span><span className="text-muted-foreground">Net</span><br /><strong>{formatINR(p.net)}</strong></span>
                  <span className="break-all"><span className="text-muted-foreground">UTR</span><br />{p.utr ?? "-"}</span>
                  <span><Badge tone={tone[p.status]}>{p.status.replace("_", " ")}</Badge>{p.onHoldReason && <div className="mt-1 text-danger">{p.onHoldReason}</div>}</span>
                </div>
              ))}
            </div>
          </details>
        );
      })}
      {!groups.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No payouts yet.</div>}
    </form>
  );
}
