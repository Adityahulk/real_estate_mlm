import { payoutSummary } from "@/lib/services/payouts";
import { PayoutManager } from "@/components/payout-manager";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";

export default async function PayoutsPage() {
  const s = await payoutSummary();
  const dueBy = new Date();
  dueBy.setHours(23, 59, 59, 999);
  const records = s.recent.map((p) => ({
    id: p.id,
    date: p.payoutDate.toISOString().slice(0, 10),
    memberId: p.member.memberId,
    memberName: p.member.fullName,
    gross: p.grossAmount.toNumber(),
    adminCharge: p.adminCharge.toNumber(),
    net: p.netAmount.toNumber(),
    paid: p.paidAmount.toNumber(),
    paymentMode: p.paymentMode,
    status: p.status,
    onHoldReason: p.onHoldReason,
    isDue: p.payoutDate <= dueBy,
    purposes: p.commissions.map((c) => ({
      type: c.incomeType.replace(/_/g, " "),
      source: `${c.sourceMember.memberId} · ${c.sourceMember.fullName}`,
    })),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Process Due Payouts</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Commission is paid out the next day after each verified payment, minus a 5% admin charge.
            Payouts for members whose KYC isn&apos;t approved are held automatically and released when KYC is approved.
            Transfers are normally processed between the 5th and 10th, and admin can record any payout amount.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pending (due)" value={formatINR(s.pending.net)} sub={`${s.pending.count} payout(s)`} />
            <Stat label="Upcoming" value={formatINR(s.upcoming.net)} sub={`${s.upcoming.count} payout(s)`} />
            <Stat label="On Hold (KYC)" value={formatINR(s.onHold.net)} sub={`${s.onHold.count} payout(s)`} />
            <Stat label="Paid (lifetime)" value={formatINR(s.paid.net)} sub={`${s.paid.count} payout(s)`} />
          </div>
          {s.pending.count === 0 && s.upcoming.count > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">There are no payouts due today. Upcoming payouts cannot be processed before their scheduled date.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout Records</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Payout lines are grouped by member and payout date. Expand a group to see every underlying commission payout.</p>
        </CardHeader>
        <CardContent><PayoutManager records={records} /></CardContent>
      </Card>
    </div>
  );
}
