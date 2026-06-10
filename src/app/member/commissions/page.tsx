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
  const incomeByType = ledger.reduce<Record<string, number>>((totals, line) => {
    totals[line.incomeType] = (totals[line.incomeType] ?? 0) + line.cashAmount.toNumber();
    return totals;
  }, {});
  const levelIncome = Object.entries(incomeByType)
    .filter(([type]) => type.startsWith("LEVEL_"))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const totalIncome = ledger.reduce((sum, line) => sum + line.cashAmount.toNumber(), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Sponsor Income" value={formatINR(incomeByType.DIRECT_SPONSOR ?? 0)} />
        <Stat label="Co-Sponsor Income" value={formatINR(incomeByType.CO_SPONSOR ?? 0)} />
        <Stat label="Super Sponsor Income" value={formatINR(incomeByType.SUPER_SPONSOR ?? 0)} />
        <Stat label="Level Income" value={formatINR(levelIncome)} sub="Level 1 to Level 7" />
        <Stat label="Total Income" value={formatINR(totalIncome)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="On Hold (KYC)" value={formatINR(d.income.onHold)} />
        <Stat label="Pending" value={formatINR(d.income.pending)} />
        <Stat label="Paid Out" value={formatINR(d.income.paidOut)} />
        <Stat label="Admin Charge" value={formatINR(d.income.adminDeducted)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission Ledger</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            A positive 5% admin deduction is applied to gross income. Net payable = Gross income − Admin deduction.
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
                <th className="px-4 py-2">Admin Deduction (5%)</th>
                <th className="px-4 py-2">Net Payable</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => {
                const gross = l.cashAmount.toNumber();
                const adminDeduction = Math.round(gross * 0.05 * 100) / 100;
                const net = Math.round((gross - adminDeduction) * 100) / 100;
                return (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{l.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-2">{l.sourceMember.memberId}</td>
                    <td className="px-4 py-2">{l.incomeType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2">{formatINR(gross)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatINR(adminDeduction)}</td>
                    <td className="px-4 py-2 font-medium">{formatINR(net)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={tone[l.status]}>{l.status === "HOLD" ? "ON HOLD" : l.status}</Badge>
                    </td>
                  </tr>
                );
              })}
              {ledger.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No income yet. Share your referral link to start earning.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
