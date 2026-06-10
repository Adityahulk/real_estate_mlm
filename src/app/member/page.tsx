import Link from "next/link";
import { currentMember, downlineTree, memberDashboard } from "@/lib/services/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge, Button } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { PageHeading } from "@/components/brand";
import { eligibleDrawMembers } from "@/lib/services/draws";
import { BinaryTree } from "@/components/binary-tree";

const kycTone = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", NOT_STARTED: "neutral" } as const;
const rankTone = { NONE: "neutral", BRONZE: "brand", SILVER: "success", GOLD: "warning" } as const;

export default async function MemberDashboard() {
  const me = await currentMember();
  const [d, eligiblePool, tree] = await Promise.all([memberDashboard(me.id), eligibleDrawMembers(), me.plotId ? downlineTree(me.id, 2) : undefined]);
  const isDrawEligibleNow = eligiblePool.some((member) => member.id === me.id);

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow={`Member ID ${me.memberId}`}
        title={`Welcome, ${me.fullName.split(" ")[0]}`}
        description={me.plotId ? `Paid member since ${me.joinDate.toISOString().slice(0, 10)}` : "Free member account · Contact admin for plot activation"}
      />

      {!me.plotId && (
        <Card className="border-brand/40 bg-brand/5 p-4">
          <div className="font-medium">Your free member account is active</div>
          <div className="text-sm text-muted-foreground">You can log in and refer others now using your auto-generated member ID as the Sponsor ID. Admin will later assign your selected plot and place you in the paid binary tree.</div>
        </Card>
      )}

      {d.income.onHold > 0 && me.kycStatus !== "APPROVED" && (
        <Card className="border-warning/40 bg-warning/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Complete your KYC to receive payouts</div>
              <div className="text-sm text-muted-foreground">Installment payments are allowed without KYC, but income payouts stay on hold until KYC is approved.</div>
            </div>
            <Link href="/member/kyc"><Button>Complete KYC</Button></Link>
          </div>
        </Card>
      )}

      {d.nextEmi && d.daysLeft !== null && d.daysLeft <= 7 && (
        <Card className="border-danger/40 bg-danger/5 p-4">
          <div className="font-medium text-danger">
            EMI #{d.nextEmi.installmentNo} due in {d.daysLeft} day{d.daysLeft === 1 ? "" : "s"} — pay by{" "}
            {d.nextEmi.payByDate.toISOString().slice(0, 10)}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending Income" value={formatINR(d.income.pending)} sub={d.income.onHold > 0 ? `On hold ${formatINR(d.income.onHold)}` : "Due next day"} />
        <Stat label="Paid Out" value={formatINR(d.income.paidOut)} sub={`Admin charge ${formatINR(d.income.adminDeducted)}`} />
        <Stat
          label="Next EMI"
          value={d.nextEmi ? formatINR(d.nextEmi.amountDue) : "—"}
          sub={d.nextEmi ? `Pay by ${d.nextEmi.payByDate.toISOString().slice(0, 10)}` : "All cleared"}
        />
        <Stat label="Direct Referrals" value={d.rank.directReferrals} sub={`Bronze bonus at ${d.rank.bronzeTarget}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>My Plot</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row k="Plot Number" v={me.plot?.plotNumber ?? "—"} />
            <Row k="Size" v={me.plot?.plotSize ?? "—"} />
            <Row k="Fixed Plot Price" v={me.plot ? formatINR(me.plot.plotPrice) : "—"} />
            <Row k="Location" v={me.plot?.locationBlock ?? "—"} />
            <Row k="Status" v={<Badge tone={me.plot ? "brand" : "neutral"}>{me.plot?.status ?? "AWAITING ACTIVATION"}</Badge>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status & Rewards</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row k="KYC" v={<Badge tone={kycTone[me.kycStatus]}>{me.kycStatus.replace("_", " ")}</Badge>} />
            <Row k="My Member ID" v={me.memberId} />
            <Row k="Sponsor ID" v={me.sponsor?.memberId ?? "COMPANY"} />
            <Row k="Rank" v={<Badge tone={rankTone[me.rank]}>{me.rank}</Badge>} />
            <Row k="Draw Eligible" v={<Badge tone={isDrawEligibleNow ? "success" : "neutral"}>{isDrawEligibleNow ? "Yes" : "No"}</Badge>} />
            <Row k="Team (L / R)" v={`${d.pair.left} / ${d.pair.right}`} />
            <Row k="Pair Rewards" v={d.pair.unlocked.length ? d.pair.unlocked.join(", ") : "Silver at 25+25"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>My Direct Team ({d.directTeam.length})</CardTitle>
            <Link href="/member/referral"><Button size="sm" variant="outline">Open Refer &amp; Earn</Button></Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Paid IDs are active in the binary structure. Free IDs remain visible here until admin activates their plot.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {d.directTeam.map((member) => {
            const paid = !!member.plotId;
            return (
              <Link
                key={member.id}
                href={paid ? `/member/tree?root=${encodeURIComponent(member.memberId)}` : "/member/referral"}
                className={`rounded-lg border p-3 transition hover:border-brand ${paid ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{member.memberId}</div>
                    <div className="text-sm">{member.fullName}</div>
                    <div className="text-xs text-muted-foreground">{member.mobile}</div>
                  </div>
                  <Badge tone={paid ? "success" : "danger"}>{paid ? "Active / Paid" : "Free / Inactive"}</Badge>
                </div>
              </Link>
            );
          })}
          {!d.directTeam.length && <div className="py-4 text-sm text-muted-foreground">No direct team members yet.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>My Binary Tree</CardTitle>
            <Link href="/member/tree"><Button size="sm" variant="outline">View Full Tree</Button></Link>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex min-w-max justify-center py-2"><BinaryTree node={tree} maxDepth={2} /></div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
