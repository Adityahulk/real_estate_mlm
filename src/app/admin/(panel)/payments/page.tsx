import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { FIXED_PLOT_PRICE } from "@/lib/business-rules";
import { AdminPaymentEntryForm } from "@/components/admin-payment-entry-form";

export default async function AdminPaymentsPage() {
  const [members, openEmis, payments, verifiedPaymentSums] = await Promise.all([
    prisma.member.findMany({
      where: { NOT: { memberId: "COMPANY" } },
      select: { id: true, memberId: true, fullName: true, paymentPlan: true },
      orderBy: { memberId: "asc" },
    }),
    prisma.emiSchedule.findMany({
      where: { status: { in: ["UPCOMING", "DUE", "OVERDUE"] } },
      include: { member: { select: { memberId: true, fullName: true } } },
      orderBy: [{ dueDate: "asc" }, { installmentNo: "asc" }],
    }),
    prisma.payment.findMany({
      include: { member: { select: { memberId: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.groupBy({
      by: ["memberId"],
      where: { status: "VERIFIED" },
      _sum: { amount: true },
    }),
  ]);

  const paidAmountByMember = new Map(
    verifiedPaymentSums.map((row) => [row.memberId, row._sum.amount?.toNumber() ?? 0])
  );
  const paymentMembers = members.map((member) => {
    const memberEmis = openEmis
      .filter((emi) => emi.memberId === member.id)
      .map((emi) => ({
        id: emi.id,
        installmentNo: emi.installmentNo,
        amount: emi.amountDue.toFixed(2),
        label: `${emi.member.memberId} · EMI #${emi.installmentNo} · ${formatINR(emi.amountDue)}`,
      }));
    const paid = paidAmountByMember.get(member.id) ?? 0;
    const cashbackRemaining = Math.max(FIXED_PLOT_PRICE - paid, 0).toFixed(2);

    return {
      ...member,
      cashbackRemaining,
      openEmis: memberEmis,
    };
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Record Offline Payment</CardTitle></CardHeader>
        <CardContent>
          <AdminPaymentEntryForm members={paymentMembers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Payments</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{p.paymentDate.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2">{p.member.memberId}</td>
                  <td className="px-4 py-2">{p.paymentType}</td>
                  <td className="px-4 py-2">{p.paymentMode}</td>
                  <td className="px-4 py-2">{formatINR(p.amount)}</td>
                  <td className="px-4 py-2"><Badge tone={p.status === "VERIFIED" ? "success" : "neutral"}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
