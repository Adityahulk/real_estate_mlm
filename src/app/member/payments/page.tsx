import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import QRCode from "qrcode";

const emiTone = { PAID: "success", DUE: "warning", OVERDUE: "danger", UPCOMING: "neutral", WAIVED: "neutral" } as const;
const paymentTone = { PENDING: "warning", VERIFIED: "success", FAILED: "danger", REFUNDED: "neutral" } as const;

export default async function PaymentsPage() {
  const me = await currentMember();
  const [schedule, bookingPaid, payments, cashbackCredits, companyPaymentData] = await Promise.all([
    prisma.emiSchedule.findMany({ where: { memberId: me.id }, orderBy: { installmentNo: "asc" } }),
    prisma.payment.findFirst({ where: { memberId: me.id, paymentType: "BOOKING", status: "VERIFIED" } }),
    prisma.payment.findMany({ where: { memberId: me.id }, orderBy: { createdAt: "desc" } }),
    prisma.cashbackCredit.findMany({ where: { memberId: me.id }, orderBy: { monthNo: "asc" } }),
    getSetting("company_payment_qr_data"),
  ]);
  const companyPaymentQr = companyPaymentData ? await QRCode.toDataURL(companyPaymentData, { width: 320, margin: 1 }) : null;
  const cashbackPaid = payments.some((payment) => payment.paymentType === "CASHBACK_FULL" && payment.status === "VERIFIED");
  const generatedRequests = payments.filter((payment) => payment.status === "PENDING");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Pay Company by QR</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {companyPaymentQr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyPaymentQr} alt="Company payment QR code" className="h-52 w-52 rounded-lg border bg-white p-2" />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              Company payment QR will appear after admin configures it.
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Scan this QR to pay the company.</p>
            <p className="mt-2">Include your member ID <b>{me.memberId}</b> in the payment note. Only admin can verify and mark payments as paid.</p>
            {companyPaymentData && <p className="mt-3 break-all rounded-md bg-muted p-2 text-xs">{companyPaymentData}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Payment Requests</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Open any request to see amount, type, and payment note.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {generatedRequests.map((payment) => (
            <details key={payment.id} className="rounded-lg border bg-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <div className="font-semibold">{payment.paymentType.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{payment.paymentDate.toISOString().slice(0, 10)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatINR(payment.amount)}</span>
                  <Badge tone="warning">Pending</Badge>
                </div>
              </summary>
              <div className="grid gap-2 border-t p-3 text-sm sm:grid-cols-3">
                <div><span className="text-muted-foreground">Mode</span><br /><b>{payment.paymentMode.replace("_", " ")}</b></div>
                <div><span className="text-muted-foreground">Reference</span><br /><b>{payment.referenceNumber ?? "-"}</b></div>
                <div><span className="text-muted-foreground">Note</span><br /><b>{payment.notes ?? "Pay using company QR and inform admin."}</b></div>
              </div>
            </details>
          ))}
          {!generatedRequests.length && <div className="py-4 text-center text-sm text-muted-foreground">No generated payment request pending.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Booking Payment</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Admin collected the booking amount before this member account was approved.
          </div>
          {bookingPaid ? (
            <Badge tone="success">Admin received · {formatINR(bookingPaid.amount)}</Badge>
          ) : (
            <Badge tone="warning">Pending admin verification</Badge>
          )}
        </CardContent>
      </Card>

      {me.paymentPlan === "CASHBACK" && (
        <Card>
          <CardHeader><CardTitle>Cashback Plan</CardTitle></CardHeader>
          <CardContent>
            {!cashbackPaid ? (
              <div className="text-sm text-muted-foreground">
                Admin will record the full payment after collecting it.
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                {cashbackCredits.map((credit) => (
                  <div key={credit.id} className="flex justify-between border-b py-1.5 last:border-0">
                    <span>Month {credit.monthNo} · {credit.creditDate.toISOString().slice(0, 10)}</span>
                    <span>{formatINR(credit.amount)} · <Badge tone={credit.status === "PAID" ? "success" : "neutral"}>{credit.status}</Badge></span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No EMI schedule (cashback plan).</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {payments.map((p) => (
            <details key={p.id} className="rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <span>
                  {p.paymentDate.toISOString().slice(0, 10)} ·{" "}
                  {p.paymentType === "BOOKING" ? "Admin collected booking amount" : p.paymentType.replace("_", " ")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{formatINR(p.amount)}</span>
                  <Badge tone={paymentTone[p.status]}>{p.status}</Badge>
                </span>
              </summary>
              <div className="grid gap-2 border-t p-3 text-xs sm:grid-cols-3">
                <div><span className="text-muted-foreground">Mode</span><br /><b>{p.paymentMode.replace("_", " ")}</b></div>
                <div><span className="text-muted-foreground">Reference</span><br /><b>{p.referenceNumber ?? "-"}</b></div>
                <div>{p.receiptUrl ? <a className="text-brand-foreground underline" href={p.receiptUrl} target="_blank">Open Receipt</a> : <span className="text-muted-foreground">Receipt pending</span>}</div>
              </div>
            </details>
          ))}
          {payments.length === 0 && <div className="py-4 text-center text-muted-foreground">No payments yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
