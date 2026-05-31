import { currentMember, memberDashboard } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge } from "@/components/ui";
import { formatINR } from "@/lib/money";

const tone = { PAID: "success", POINTS: "warning", APPROVED: "brand", HOLD: "danger" } as const;

export default async function CommissionsPage() {
  const me = await currentMember();
  const d = await memberDashboard(me.id);
  const ledger = await prisma.commissionLedger.findMany({
    where: { beneficiaryId: me.id },
    include: { sourceMember: { select: { memberId: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="On Hold (KYC)" value={formatINR(d.income.onHold)} />
        <Stat label="Pending (next day)" value={formatINR(d.income.pending)} />
        <Stat label="Paid Out" value={formatINR(d.income.paidOut)} />
        <Stat label="Admin Charge Deducted" value={formatINR(d.income.adminDeducted)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission Ledger</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Income is transferred the next day after each verified payment, minus a 5% admin charge. Net = Gross × 0.95.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Gross</th>
                <th className="px-4 py-2">Net (−5%)</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => {
                const gross = l.cashAmount.toNumber();
                const net = Math.round(gross * 0.95 * 100) / 100;
                return (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{l.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-2">{l.sourceMember.memberId}</td>
                    <td className="px-4 py-2">{l.incomeType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2">{formatINR(gross)}</td>
                    <td className="px-4 py-2 font-medium">{formatINR(net)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={tone[l.status]}>{l.status === "HOLD" ? "ON HOLD" : l.status}</Badge>
                    </td>
                  </tr>
                );
              })}
              {ledger.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No income yet. Share your referral link to start earning.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
