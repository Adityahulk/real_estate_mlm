import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { PAIR_REWARD_LABELS } from "@/lib/engines/eligibility";
import { Badge, Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";

const rankTone = { NONE: "neutral", BRONZE: "brand", SILVER: "success", GOLD: "warning" } as const;

export default async function RewardsPage() {
  const member = await currentMember();
  const rewards = await prisma.pairRewardRecord.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Rank" value={<Badge tone={rankTone[member.rank]}>{member.rank}</Badge>} />
        <Stat label="Direct Referrals" value={member.directReferralCount} sub="Bronze bonus eligibility at 11 direct sponsors" />
        <Stat label="Team L / R" value={`${member.leftTeamCount} / ${member.rightTeamCount}`} sub="Old + new downline IDs are counted together" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rank & Achievement Rules</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Team IDs are placed automatically left-to-right and top-to-bottom. Every ID below you is added into your achievement totals.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border border-brand/30 bg-brand/5 p-3">
            <b>Bronze Rank:</b> 11 direct sponsors. If any direct referral wins a lucky draw prize, a Bronze-qualified sponsor also receives the same prize. No Bronze qualification means no bonus prize.
          </div>
          {(["ACTIVA", "CAR"] as const).map((type) => {
            const reward = rewards.find((r) => r.type === type);
            const meta = PAIR_REWARD_LABELS[type];
            return (
              <div key={type} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
                <span>
                  <b>{meta.rank} Rank</b> · {meta.target} · Gift: {meta.gift}
                </span>
                <Badge tone={reward ? "success" : "neutral"}>{reward?.status ?? "LOCKED"}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>7-Level Two-Leg Plan</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Each member has Left and Right legs. After two sponsored members, the 3rd, 4th, and later IDs are placed automatically wherever space is available in the downline, following left-to-right and top-to-bottom placement.
        </CardContent>
      </Card>
    </div>
  );
}
