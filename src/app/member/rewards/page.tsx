import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { Badge, Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";

export default async function RewardsPage() {
  const member = await currentMember();
  const rewards = await prisma.pairRewardRecord.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "asc" } });
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><Stat label="Rank" value={member.rank}/><Stat label="Direct Referrals" value={member.directReferralCount} sub="Bronze at 11"/><Stat label="Team L / R" value={`${member.leftTeamCount} / ${member.rightTeamCount}`}/></div><Card><CardHeader><CardTitle>Pair Rewards</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{["ACTIVA","CAR"].map(type=>{const reward=rewards.find(r=>r.type===type); const target=type==="ACTIVA"?"25 Left + 25 Right":"150 Left + 150 Right"; return <div key={type} className="flex justify-between border-b py-2"><span><b>{type}</b> · {target}</span><Badge tone={reward?"success":"neutral"}>{reward?.status??"LOCKED"}</Badge></div>})}</CardContent></Card></div>;
}
