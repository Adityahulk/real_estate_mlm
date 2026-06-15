import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { MemberWithdrawalCard } from "@/components/member-withdrawal-card";

const tone = { PENDING: "warning", PROCESSING: "brand", PAID: "success", ON_HOLD: "danger", FAILED: "danger" } as const;

export default async function WithdrawalPage() {
  const me = await currentMember();
  const payouts = await prisma.payout.findMany({
    where: { memberId: me.id },
    orderBy: [{ payoutDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return (
    <div className="space-y-4">
      <MemberWithdrawalCard memberId={me.id} />

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Records</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Track requested, paid, and held payout lines here.</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {payouts.map((payout) => (
            <div key={payout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div>
                <div className="font-medium">{payout.payoutDate.toISOString().slice(0, 10)}</div>
                <div className="text-xs text-muted-foreground">
                  Net {formatINR(payout.netAmount)} · Paid {formatINR(payout.paidAmount)} · Mode {payout.paymentMode.replace("_", " ")}
                </div>
                {payout.onHoldReason && <div className="text-xs text-danger">{payout.onHoldReason}</div>}
              </div>
              <Badge tone={tone[payout.status]}>{payout.status.replace("_", " ")}</Badge>
            </div>
          ))}
          {!payouts.length && <div className="py-4 text-center text-muted-foreground">No withdrawal records yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
