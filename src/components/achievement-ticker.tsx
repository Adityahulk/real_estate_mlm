import { prisma } from "@/lib/db";

const rankLabel = {
  BRONZE: "Bronze Achiever",
  SILVER: "Silver Achiever",
  GOLD: "Gold Achiever",
} as const;

export async function AchievementTicker() {
  let achievers: { memberId: string; fullName: string; rank: "BRONZE" | "SILVER" | "GOLD" }[] = [];
  try {
    achievers = await prisma.member.findMany({
      where: { rank: { in: ["BRONZE", "SILVER", "GOLD"] }, isActive: true, NOT: { memberId: "COMPANY" } },
      select: { memberId: true, fullName: true, rank: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }) as typeof achievers;
  } catch {
    return null;
  }
  if (!achievers.length) return null;

  const items = [...achievers, ...achievers];
  return (
    <aside className="achievement-ticker" aria-label="Latest rank achievements">
      <div className="achievement-ticker-label">Latest Achievements</div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="achievement-ticker-track">
          {items.map((member, index) => (
            <span key={`${member.memberId}-${index}`} className="achievement-ticker-item">
              <strong>{member.fullName}</strong>
              <span>{member.memberId}</span>
              <b data-rank={member.rank}>{rankLabel[member.rank]}</b>
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
