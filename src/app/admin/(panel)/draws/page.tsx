import { prisma } from "@/lib/db";
import { DEFAULT_DRAW_PRIZES, eligibleDrawMembers } from "@/lib/services/draws";
import { getNumberSetting } from "@/lib/settings";
import { conductDrawAction, markDrawPrizeClaimedAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";

const winnerTone = { WON: "warning", CLAIMED: "success", PENDING_DOCS: "danger" } as const;

export default async function AdminDrawsPage() {
  const [eligible, events, bookedPlots, triggerPlots] = await Promise.all([
    eligibleDrawMembers(),
    prisma.drawEvent.findMany({
      include: {
        conductedBy: { select: { name: true } },
        winners: {
          include: {
            member: { select: { memberId: true, fullName: true, mobile: true } },
            sponsor: { select: { memberId: true, fullName: true } },
          },
          orderBy: { prizeRank: "asc" },
        },
      },
      orderBy: { drawNumber: "desc" },
      take: 20,
    }),
    prisma.plot.count({ where: { status: { in: ["BOOKED", "SOLD", "DRAW_WON"] } } }),
    getNumberSetting("draw_trigger_plots"),
  ]);

  const previousWinnerCount = await prisma.drawWinner.count();

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Eligible Pool" value={eligible.length} sub="Previous winners excluded" />
        <Stat label="Completed Draws" value={events.filter((event) => event.status === "COMPLETED").length} />
        <Stat label="Lifetime Winners" value={previousWinnerCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conduct Lucky Draw</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Draw starts after {triggerPlots} plots are booked. Current booked plots: {bookedPlots}.
          </p>
        </CardHeader>
        <CardContent>
          <StatefulForm action={conductDrawAction}>
            <div className="mb-4 grid gap-2 text-sm sm:grid-cols-5">
              {DEFAULT_DRAW_PRIZES.map((prize, index) => (
                <div key={prize.name} className="rounded-lg border px-3 py-2">
                  <div className="text-xs text-muted-foreground">Prize #{index + 1}</div>
                  <div className="font-medium">{prize.name}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Eligible members must be active, KYC-approved, and paid during the monthly payment window: 1st to 25th. Draw is conducted between the 5th and 10th. Plot-prize documentation happens in the final month, conditions apply.
              </p>
              <SubmitButton>Conduct 5-Prize Draw</SubmitButton>
            </div>
          </StatefulForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current Eligible Members ({eligible.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Referrer</th>
                <th className="px-4 py-2">Plot</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((member) => (
                <tr key={member.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{member.memberId}</td>
                  <td className="px-4 py-2">{member.fullName}</td>
                  <td className="px-4 py-2">{member.sponsor?.memberId ?? "—"}</td>
                  <td className="px-4 py-2">{member.plot?.plotNumber ?? "—"}</td>
                </tr>
              ))}
              {eligible.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No eligible members.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Draw #{event.drawNumber}</CardTitle>
                <Badge tone={event.status === "COMPLETED" ? "success" : "neutral"}>{event.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.drawDate.toISOString().slice(0, 10)} · Eligible pool {event.eligibleCount} · Conducted by {event.conductedBy?.name ?? "Admin"} · Seed {event.randomSeed ?? "—"}
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Rank</th>
                    <th className="px-4 py-2">Winner</th>
                    <th className="px-4 py-2">Prize</th>
                    <th className="px-4 py-2">Value</th>
                    <th className="px-4 py-2">Referrer</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {event.winners.map((winner) => (
                    <tr key={winner.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-semibold">#{winner.prizeRank}</td>
                      <td className="px-4 py-2">{winner.member.memberId} · {winner.member.fullName}</td>
                      <td className="px-4 py-2">{winner.prizeName}</td>
                      <td className="px-4 py-2">{winner.prizeValue ? formatINR(winner.prizeValue) : "—"}</td>
                      <td className="px-4 py-2">{winner.sponsor?.memberId ?? "—"}</td>
                      <td className="px-4 py-2"><Badge tone={winnerTone[winner.status]}>{winner.status.replace("_", " ")}</Badge></td>
                      <td className="px-4 py-2 text-right">
                        {winner.status !== "CLAIMED" && (
                          <form action={markDrawPrizeClaimedAction.bind(null, winner.id)}>
                            <Button type="submit" size="sm" variant="outline">Mark Claimed</Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
        {events.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No draws conducted yet.</Card>}
      </div>
    </div>
  );
}
