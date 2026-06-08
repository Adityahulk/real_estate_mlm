import Link from "next/link";
import { currentMember, memberDashboard } from "@/lib/services/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge, Button } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { PageHeading } from "@/components/brand";
import { eligibleDrawMembers } from "@/lib/services/draws";

const kycTone = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", NOT_STARTED: "neutral" } as const;
const rankTone = { NONE: "neutral", BRONZE: "brand", SILVER: "success", GOLD: "warning" } as const;

export default async function MemberDashboard() {
  const me = await currentMember();
  const [d, eligiblePool] = await Promise.all([memberDashboard(me.id), eligibleDrawMembers()]);
  const isDrawEligibleNow = eligiblePool.some((member) => member.id === me.id);

  return (
    <div className="space-y-5">
      <PageHeading eyebrow={`Member ID ${me.memberId}`} title={`Welcome, ${me.fullName.split(" ")[0]}`} description={`Plot owner since ${me.joinDate.toISOString().slice(0, 10)}`} />

      {me.kycStatus !== "APPROVED" && (
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
            <Row k="Price" v={me.plot ? formatINR(me.plot.plotPrice) : "—"} />
            <Row k="Location" v={`${me.plot?.locationBlock ?? "-"} · Row ${me.plot?.rowNumber ?? "-"}`} />
            <Row k="Status" v={<Badge tone="brand">{me.plot?.status}</Badge>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status & Rewards</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row k="KYC" v={<Badge tone={kycTone[me.kycStatus]}>{me.kycStatus.replace("_", " ")}</Badge>} />
            <Row k="Rank" v={<Badge tone={rankTone[me.rank]}>{me.rank}</Badge>} />
            <Row k="Draw Eligible" v={<Badge tone={isDrawEligibleNow ? "success" : "neutral"}>{isDrawEligibleNow ? "Yes" : "No"}</Badge>} />
            <Row k="Team (L / R)" v={`${d.pair.left} / ${d.pair.right}`} />
            <Row k="Pair Rewards" v={d.pair.unlocked.length ? d.pair.unlocked.join(", ") : "Silver at 25+25"} />
          </CardContent>
        </Card>
      </div>
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
