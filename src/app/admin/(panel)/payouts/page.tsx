import { payoutSummary } from "@/lib/services/payouts";
import { processDuePayoutsAction } from "@/server/admin-actions";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";

const tone = { PAID: "success", PENDING: "warning", ON_HOLD: "danger", FAILED: "danger", PROCESSING: "warning" } as const;

export default async function PayoutsPage() {
  const s = await payoutSummary();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Process Due Payouts</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Commission is paid out the next day after each verified payment, minus a 5% admin charge.
            Payouts for members whose KYC isn&apos;t approved are held automatically and released when KYC is approved.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Pending (due)" value={formatINR(s.pending.net)} sub={`${s.pending.count} payout(s)`} />
            <Stat label="On Hold (KYC)" value={formatINR(s.onHold.net)} sub={`${s.onHold.count} payout(s)`} />
            <Stat label="Paid (lifetime)" value={formatINR(s.paid.net)} sub={`${s.paid.count} payout(s)`} />
          </div>
          <form action={processDuePayoutsAction}>
            <Button type="submit" disabled={s.pending.count === 0}>Process Due Payouts</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payout Records</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Gross</th>
                <th className="px-4 py-2">Admin 5%</th>
                <th className="px-4 py-2">Net</th>
                <th className="px-4 py-2">UTR</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{p.payoutDate.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2">{p.member.memberId} · {p.member.fullName}</td>
                  <td className="px-4 py-2">{formatINR(p.grossAmount)}</td>
                  <td className="px-4 py-2">{formatINR(p.adminCharge)}</td>
                  <td className="px-4 py-2 font-medium">{formatINR(p.netAmount)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.utrNumber ?? "-"}</td>
                  <td className="px-4 py-2">
                    <Badge tone={tone[p.status]}>{p.status.replace("_", " ")}</Badge>
                    {p.status === "ON_HOLD" && <div className="text-[10px] text-muted-foreground">{p.onHoldReason}</div>}
                  </td>
                </tr>
              ))}
              {s.recent.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No payouts yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
