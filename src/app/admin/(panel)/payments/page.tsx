import { prisma } from "@/lib/db";
import { recordOfflinePaymentAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Badge, Field, Input, Select } from "@/components/ui";
import { formatINR } from "@/lib/money";

export default async function AdminPaymentsPage() {
  const [members, openEmis, payments] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Record Offline Payment</CardTitle></CardHeader>
        <CardContent>
          <StatefulForm action={recordOfflinePaymentAction}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Member">
                <Select name="memberId">
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.memberId} · {m.fullName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment Type">
                <Select name="paymentType" defaultValue="EMI">
                  <option value="EMI">EMI installment</option>
                  <option value="CASHBACK_FULL">Cashback plan full payment</option>
                </Select>
              </Field>
              <Field label="EMI Installment">
                <Select name="emiScheduleId" defaultValue="">
                  <option value="">Select only for EMI payment</option>
                  {openEmis.map((emi) => (
                    <option key={emi.id} value={emi.id}>
                      {emi.member.memberId} · EMI #{emi.installmentNo} · {formatINR(emi.amountDue)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount (₹)"><Input name="amount" inputMode="numeric" placeholder="10000" /></Field>
              <Field label="Payment Mode">
                <Select name="paymentMode">
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="OFFLINE">Other Offline</option>
                </Select>
              </Field>
              <Field label="Reference Number"><Input name="referenceNumber" placeholder="UTR / txn id" /></Field>
              <Field label="Payment Date"><Input name="paymentDate" type="date" /></Field>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Booking payments are recorded during member approval. For an EMI, select its exact installment. For a cashback member, choose full payment and enter the remaining plot balance.
            </p>
            <SubmitButton>Verify &amp; Record</SubmitButton>
          </StatefulForm>
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
