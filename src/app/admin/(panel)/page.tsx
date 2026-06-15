import Link from "next/link";
import { adminOverview } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { approveApplicationAction, rejectApplicationAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { PageHeading } from "@/components/brand";
import { FIXED_BOOKING_AMOUNT } from "@/lib/business-rules";

export default async function AdminOverview() {
  const [o, applications, availablePlots, openRequests] = await Promise.all([
    adminOverview(),
    prisma.memberApplication.findMany({
      where: { status: "PENDING" },
      include: {
        sponsor: { select: { memberId: true, fullName: true } },
        referrerApplication: { select: { applicationCode: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.plot.findMany({
      where: { status: "AVAILABLE" },
      select: { plotNumber: true },
      orderBy: { plotNumber: "asc" },
    }),
    prisma.supportRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Administration" title="Project Overview" description="Monitor applications, plots, collections, commissions, and daily operations." />
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
            Free members can already log in and refer others using their auto-generated Member ID. After collecting the token amount, enter the customer&apos;s selected available plot number to activate their plot and place them in the paid binary tree.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {applications.map((application) => (
            <div key={application.id} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="mb-3 grid gap-1 text-sm sm:grid-cols-3">
                <div><span className="text-muted-foreground">Applicant:</span> <b>{application.fullName}</b></div>
                <div><span className="text-muted-foreground">Mobile:</span> <b>{application.mobile}</b></div>
                <div><span className="text-muted-foreground">Referred by:</span> <b>{application.sponsor ? `${application.sponsor.memberId} · ${application.sponsor.fullName}` : application.referrerApplication ? `${application.referrerApplication.applicationCode} · ${application.referrerApplication.fullName}` : "No referrer"}</b></div>
                <div><span className="text-muted-foreground">Member ID:</span> <b>{application.applicationCode}</b></div>
                <div><span className="text-muted-foreground">Nominee:</span> <b>{application.nomineeName ?? "—"} · {application.nomineeRelation ?? "—"} · {application.nomineePhone ?? "—"}</b></div>
              </div>
              <StatefulForm action={approveApplicationAction}>
                <input type="hidden" name="applicationId" value={application.id} />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Customer Plot Number">
                    <Input name="plotNumber" list="available-plot-numbers" placeholder="e.g. P001" />
                  </Field>
                  <Field label="Booking Amount">
                    <Input value={FIXED_BOOKING_AMOUNT} readOnly aria-readonly="true" />
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
              <form action={rejectApplicationAction.bind(null, application.id)} className="mt-2 flex justify-end">
                <Button type="submit" variant="danger" size="sm">Reject Application</Button>
              </form>
            </div>
          ))}
          {applications.length === 0 && (
            <div className="py-3 text-center text-sm text-muted-foreground">No pending member applications.</div>
          )}
          <datalist id="available-plot-numbers">
            {availablePlots.map((plot) => <option key={plot.plotNumber} value={plot.plotNumber} />)}
          </datalist>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Commissions Due" value={formatINR(o.commissionsDue)} sub="POINTS + APPROVED" />
        <Stat label="Paid Out" value={formatINR(o.paidOut)} />
        <Card className="p-4">
          <CardHeader className="p-0"><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 p-0 pt-3 text-sm">
            <Link href="/admin/kyc" className="text-brand-foreground underline">Review pending KYC ({o.pendingKyc})</Link>
            <Link href="/admin/payments" className="text-brand-foreground underline">Generate or verify payment</Link>
            <Link href="/admin/payouts" className="text-brand-foreground underline">Process monthly payout</Link>
            <Link href="/admin/requests" className="text-brand-foreground underline">Open member requests ({openRequests})</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
