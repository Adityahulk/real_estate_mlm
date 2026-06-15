import { currentMember, memberDashboard } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { MemberWithdrawalCard } from "@/components/member-withdrawal-card";
import Link from "next/link";

const tone = { PAID: "success", POINTS: "warning", APPROVED: "brand", HOLD: "danger" } as const;

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const me = await currentMember();
  const selectedType = (await searchParams).type ?? "ALL";
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
  const filteredLedger = ledger.filter((line) => {
    if (selectedType === "ALL") return true;
    if (selectedType === "LEVEL") return line.incomeType.startsWith("LEVEL_");
    return line.incomeType === selectedType;
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Link href="/member/commissions?type=DIRECT_SPONSOR"><Stat label="Sponsor Income" value={formatINR(incomeByType.DIRECT_SPONSOR ?? 0)} sub="Click for history" /></Link>
        <Link href="/member/commissions?type=CO_SPONSOR"><Stat label="Co-Sponsor Income" value={formatINR(incomeByType.CO_SPONSOR ?? 0)} sub="Click for history" /></Link>
        <Link href="/member/commissions?type=SUPER_SPONSOR"><Stat label="Super Sponsor Income" value={formatINR(incomeByType.SUPER_SPONSOR ?? 0)} sub="Click for history" /></Link>
        <Link href="/member/commissions?type=LEVEL"><Stat label="Level Income" value={formatINR(levelIncome)} sub="Click for Level 1 to Level 7 history" /></Link>
        <Link href="/member/commissions"><Stat label="Total Income" value={formatINR(totalIncome)} sub="Click for all history" /></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="On Hold (KYC)" value={formatINR(d.income.onHold)} />
        <Stat label="Pending" value={formatINR(d.income.pending)} />
        <Stat label="Paid Out" value={formatINR(d.income.paidOut)} />
        <Stat label="Admin Charge" value={formatINR(d.income.adminDeducted)} />
      </div>

      <MemberWithdrawalCard memberId={me.id} />

      <Card>
        <CardHeader>
          <CardTitle>Commission Ledger</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing {selectedType === "ALL" ? "all income" : selectedType === "LEVEL" ? "all level income" : selectedType.replaceAll("_", " ").toLowerCase()}. Each row shows the member and date that generated the income.
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
              {filteredLedger.map((l) => {
                const gross = l.cashAmount.toNumber();
                const adminDeduction = Math.round(gross * 0.05 * 100) / 100;
                const net = Math.round((gross - adminDeduction) * 100) / 100;
                return (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{l.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-2"><b>{l.sourceMember.memberId}</b><br /><span className="text-xs text-muted-foreground">{l.sourceMember.fullName}</span></td>
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
              {filteredLedger.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No income history for this section yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
