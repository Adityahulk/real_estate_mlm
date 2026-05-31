import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { payOnlineAction } from "@/server/member-actions";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { formatINR } from "@/lib/money";

const emiTone = { PAID: "success", DUE: "warning", OVERDUE: "danger", UPCOMING: "neutral", WAIVED: "neutral" } as const;

export default async function PaymentsPage() {
  const me = await currentMember();
  const [schedule, bookingPaid, payments] = await Promise.all([
    prisma.emiSchedule.findMany({ where: { memberId: me.id }, orderBy: { installmentNo: "asc" } }),
    prisma.payment.findFirst({ where: { memberId: me.id, paymentType: "BOOKING", status: "VERIFIED" } }),
    prisma.payment.findMany({ where: { memberId: me.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const kycOk = me.kycStatus === "APPROVED";

  return (
    <div className="space-y-4">
      {!kycOk && (
        <Card className="border-warning/40 bg-warning/5 p-4 text-sm">
          Complete and get your KYC approved before making any payment.
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Booking Payment</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            One-time booking amount to confirm your plot.
          </div>
          {bookingPaid ? (
            <Badge tone="success">Paid · {formatINR(bookingPaid.amount)}</Badge>
          ) : (
            <form action={payOnlineAction}>
              <Button type="submit" disabled={!kycOk}>Pay Booking</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>EMI Schedule</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Due Date</th>
                <th className="px-4 py-2">Pay By</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{e.installmentNo}</td>
                  <td className="px-4 py-2">{e.dueDate.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2">{e.payByDate.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2">{formatINR(e.amountDue)}</td>
                  <td className="px-4 py-2"><Badge tone={emiTone[e.status]}>{e.status}</Badge></td>
                  <td className="px-4 py-2 text-right">
                    {e.status !== "PAID" && bookingPaid && (
                      <form action={payOnlineAction}>
                        <input type="hidden" name="emiScheduleId" value={e.id} />
                        <Button size="sm" type="submit" disabled={!kycOk}>Pay</Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No EMI schedule (cashback plan).</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
              <span>{p.paymentDate.toISOString().slice(0, 10)} · {p.paymentType} · {p.paymentMode}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium">{formatINR(p.amount)}</span>
                <Badge tone={p.status === "VERIFIED" ? "success" : "neutral"}>{p.status}</Badge>
                {p.receiptUrl && <a className="text-brand-foreground underline" href={p.receiptUrl} target="_blank">Receipt</a>}
              </span>
            </div>
          ))}
          {payments.length === 0 && <div className="py-4 text-center text-muted-foreground">No payments yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
