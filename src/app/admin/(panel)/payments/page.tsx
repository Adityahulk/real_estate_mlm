import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { FIXED_PLOT_PRICE } from "@/lib/business-rules";
import { AdminPaymentEntryForm } from "@/components/admin-payment-entry-form";
import { AdminPaymentRequestForm } from "@/components/admin-payment-request-form";
import { verifyPendingPaymentAction } from "@/server/admin-actions";

const statusTone = { PENDING: "warning", VERIFIED: "success", FAILED: "danger", REFUNDED: "neutral" } as const;

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
        <CardHeader>
          <CardTitle>Generate Payment Request</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Create a pending payment item for a member. The member can open it from their Payments panel and admin can verify it after payment is received.</p>
        </CardHeader>
        <CardContent>
          <AdminPaymentRequestForm members={paymentMembers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Record Offline Payment</CardTitle></CardHeader>
        <CardContent>
          <AdminPaymentEntryForm members={paymentMembers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Payments</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {payments.map((p) => (
            <details key={p.id} className="group rounded-lg border bg-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <div className="font-semibold">{p.member.memberId} · {p.member.fullName}</div>
                  <div className="text-xs text-muted-foreground">{p.paymentDate.toISOString().slice(0, 10)} · {p.paymentType.replace("_", " ")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatINR(p.amount)}</span>
                  <Badge tone={statusTone[p.status]}>{p.status}</Badge>
                </div>
              </summary>
              <div className="grid gap-3 border-t p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><span className="text-muted-foreground">Mode</span><br /><b>{p.paymentMode.replace("_", " ")}</b></div>
                <div><span className="text-muted-foreground">Reference</span><br /><b>{p.referenceNumber ?? "-"}</b></div>
                <div><span className="text-muted-foreground">Notes</span><br /><b>{p.notes ?? "-"}</b></div>
                <div className="flex items-end">
                  {p.status === "PENDING" ? (
                    <form action={verifyPendingPaymentAction.bind(null, p.id)}>
                      <Button type="submit" size="sm">Verify Payment</Button>
                    </form>
                  ) : (
                    <Badge tone={statusTone[p.status]}>{p.status}</Badge>
                  )}
                </div>
              </div>
            </details>
          ))}
          {!payments.length && <div className="py-4 text-center text-sm text-muted-foreground">No payments yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
