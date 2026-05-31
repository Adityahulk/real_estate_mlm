import Link from "next/link";
import { adminOverview } from "@/lib/services/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";

export default async function AdminOverview() {
  const o = await adminOverview();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Members" value={o.totalMembers} sub={`${o.activeMembers} active`} />
        <Stat label="Pending KYC" value={o.pendingKyc} />
        <Stat label="Plots Available" value={o.availablePlots} sub={`${o.bookedPlots} booked`} />
        <Stat label="Total Collected" value={formatINR(o.collected)} />
      </div>
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
