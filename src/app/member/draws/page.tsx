import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { eligibleDrawMembers } from "@/lib/services/draws";
import { Badge, Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";

const winnerTone = { WON: "warning", CLAIMED: "success", PENDING_DOCS: "danger" } as const;

export default async function MemberDrawsPage() {
  const member = await currentMember();
  const [wins, recentDraws, eligiblePool] = await Promise.all([
    prisma.drawWinner.findMany({
      where: { memberId: member.id },
      include: { drawEvent: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.drawEvent.findMany({
      where: { status: "COMPLETED" },
      include: {
        winners: {
          include: { member: { select: { memberId: true, fullName: true } } },
          orderBy: { prizeRank: "asc" },
        },
      },
      orderBy: { drawNumber: "desc" },
      take: 10,
    }),
    eligibleDrawMembers(),
  ]);
  const isEligibleNow = eligiblePool.some((eligible) => eligible.id === member.id) && wins.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Draw Eligible" value={isEligibleNow ? "Yes" : "No"} sub={wins.length ? "Previous winners do not re-enter" : "Same live pool as admin"} />
        <Stat label="Prizes Won" value={wins.length} />
        <Stat label="Completed Draws" value={recentDraws.length} />
      </div>

      {wins.length > 0 && (
        <Card>
          <CardHeader><CardTitle>My Winning Prizes</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {wins.map((winner) => (
              <div key={winner.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                <span>
                  Draw #{winner.drawEvent.drawNumber} · Rank #{winner.prizeRank} · <b>{winner.prizeName}</b>
                  {winner.prizeValue ? ` · ${formatINR(winner.prizeValue)}` : ""}
                </span>
                <Badge tone={winnerTone[winner.status]}>{winner.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Lucky Draw Results</h1>
        {recentDraws.map((draw) => (
          <Card key={draw.id}>
            <CardHeader>
              <CardTitle>Draw #{draw.drawNumber}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{draw.drawDate.toISOString().slice(0, 10)} · {draw.eligibleCount} eligible members</p>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {draw.winners.map((winner) => (
                <div key={winner.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                  <span>#{winner.prizeRank} · {winner.prizeName}</span>
                  <span className="font-medium">{winner.member.memberId} · {winner.member.fullName}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {recentDraws.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No lucky draw results yet.</Card>}
      </div>
    </div>
  );
}
