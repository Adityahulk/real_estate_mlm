import Link from "next/link";
import { adminOverview } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { getNumberSetting } from "@/lib/settings";
import { approveApplicationAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";

export default async function AdminOverview() {
  const [o, applications, bookingAmount] = await Promise.all([
    adminOverview(),
    prisma.memberApplication.findMany({
      where: { status: "PENDING" },
      include: { sponsor: { select: { memberId: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getNumberSetting("booking_amount"),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Members" value={o.totalMembers} sub={`${o.activeMembers} active`} />
        <Stat label="Pending Applications" value={applications.length} sub={`${o.pendingKyc} pending KYC`} />
        <Stat label="Plots Available" value={o.availablePlots} sub={`${o.bookedPlots} booked`} />
        <Stat label="Total Collected" value={formatINR(o.collected)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Member Approvals ({applications.length})</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Collect the token amount and approve the application. The next available plot number is assigned automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {applications.map((application) => (
            <div key={application.id} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="mb-3 grid gap-1 text-sm sm:grid-cols-3">
                <div><span className="text-muted-foreground">Applicant:</span> <b>{application.fullName}</b></div>
                <div><span className="text-muted-foreground">Mobile:</span> <b>{application.mobile}</b></div>
                <div><span className="text-muted-foreground">Referred by:</span> <b>{application.sponsor.memberId} · {application.sponsor.fullName}</b></div>
              </div>
              <StatefulForm action={approveApplicationAction}>
                <input type="hidden" name="applicationId" value={application.id} />
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Token Amount">
                    <Input name="tokenAmount" defaultValue={bookingAmount} inputMode="numeric" />
                  </Field>
                  <Field label="Payment Mode">
                    <Select name="paymentMode" defaultValue="CASH">
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="OFFLINE">Other Offline</option>
                    </Select>
                  </Field>
                  <Field label="Reference Number">
                    <Input name="referenceNumber" placeholder="Optional UTR / receipt" />
                  </Field>
                  <div className="flex items-end pb-3">
                    <SubmitButton className="w-full">Collect &amp; Approve</SubmitButton>
                  </div>
                </div>
              </StatefulForm>
            </div>
          ))}
          {applications.length === 0 && (
            <div className="py-3 text-center text-sm text-muted-foreground">No pending member applications.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Commissions Due" value={formatINR(o.commissionsDue)} sub="POINTS + APPROVED" />
        <Stat label="Paid Out" value={formatINR(o.paidOut)} />
        <Card className="p-4">
          <CardHeader className="p-0"><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 p-0 pt-3 text-sm">
            <Link href="/admin/kyc" className="text-brand-foreground underline">Review pending KYC ({o.pendingKyc})</Link>
            <Link href="/admin/payments" className="text-brand-foreground underline">Record offline payment</Link>
            <Link href="/admin/payouts" className="text-brand-foreground underline">Process monthly payout</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
