import { prisma } from "../db";
import { getMemberSession, getAdminSession } from "../auth";
import { redirect } from "next/navigation";
import { getAllSettings } from "../settings";
import { unlockedPairRewards } from "../engines/eligibility";

export async function currentMember() {
  const s = await getMemberSession();
  if (!s) redirect("/login");
  const member = await prisma.member.findUnique({
    where: { id: s.sub },
    include: { plot: true, kyc: true, sponsor: true },
  });
  if (!member) redirect("/login");
  if (!member.isActive) redirect("/login");
  return member;
}

export async function requireAdminOrRedirect() {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  return s;
}

export async function memberDashboard(memberId: string) {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    include: { plot: true, kyc: true },
  });

  const nextEmi = await prisma.emiSchedule.findFirst({
    where: { memberId, status: { in: ["UPCOMING", "DUE", "OVERDUE"] } },
    orderBy: { installmentNo: "asc" },
  });

  // Income is paid out per-payment next-day; aggregate from payouts (net) by status.
  const payoutAgg = await prisma.payout.groupBy({
    by: ["status"],
    where: { memberId },
    _sum: { netAmount: true, grossAmount: true, adminCharge: true },
  });
  const income = { onHold: 0, pending: 0, paidOut: 0, adminDeducted: 0, totalGross: 0 };
  for (const row of payoutAgg) {
    const net = row._sum.netAmount?.toNumber() ?? 0;
    income.totalGross += row._sum.grossAmount?.toNumber() ?? 0;
    if (row.status === "ON_HOLD") income.onHold += net;
    else if (row.status === "PENDING" || row.status === "PROCESSING") income.pending += net;
    else if (row.status === "PAID") {
      income.paidOut += net;
      income.adminDeducted += row._sum.adminCharge?.toNumber() ?? 0;
    }
  }

  const settings = await getAllSettings();
  const daysLeft = nextEmi
    ? Math.ceil((nextEmi.payByDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    member,
    nextEmi,
    daysLeft,
    income,
    rank: {
      current: member.rank,
      directReferrals: member.directReferralCount,
      bronzeTarget: Number(settings.bronze_min_referrals),
    },
    pair: {
      left: member.leftTeamCount,
      right: member.rightTeamCount,
      unlocked: unlockedPairRewards(member.leftTeamCount, member.rightTeamCount),
    },
  };
}

export async function adminOverview() {
  const [totalMembers, activeMembers, pendingKyc, availablePlots, bookedPlots] = await Promise.all([
    prisma.member.count({ where: { NOT: { memberId: "COMPANY" } } }),
    prisma.member.count({ where: { isActive: true, NOT: { memberId: "COMPANY" } } }),
    prisma.member.count({ where: { kycStatus: "PENDING" } }),
    prisma.plot.count({ where: { status: "AVAILABLE" } }),
    prisma.plot.count({ where: { status: { in: ["BOOKED", "SOLD", "DRAW_WON"] } } }),
  ]);

  const collected = await prisma.payment.aggregate({
    where: { status: "VERIFIED" },
    _sum: { amount: true },
  });
  const commissionsDue = await prisma.payout.aggregate({
    where: { status: { in: ["PENDING", "ON_HOLD", "PROCESSING"] } },
    _sum: { netAmount: true },
  });
  const paidOut = await prisma.payout.aggregate({
    where: { status: "PAID" },
    _sum: { netAmount: true },
  });

  return {
    totalMembers,
    activeMembers,
    pendingKyc,
    availablePlots,
    bookedPlots,
    collected: collected._sum.amount?.toNumber() ?? 0,
    commissionsDue: commissionsDue._sum.netAmount?.toNumber() ?? 0,
    paidOut: paidOut._sum.netAmount?.toNumber() ?? 0,
  };
}

// Builds a downline tree (BFS) up to `depth` levels for visualization.
export async function downlineTree(rootMemberId: string, depth = 3) {
  const all = await prisma.member.findMany({
    where: { plotId: { not: null }, NOT: { memberId: "COMPANY" } },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      treeParentId: true,
      treeSide: true,
      isActive: true,
      rank: true,
      leftTeamCount: true,
      rightTeamCount: true,
    },
  });
  const childrenByParent = new Map<string, typeof all>();
  for (const m of all) {
    if (!m.treeParentId) continue;
    const arr = childrenByParent.get(m.treeParentId) ?? [];
    arr.push(m);
    childrenByParent.set(m.treeParentId, arr);
  }
  type Node = (typeof all)[number] & { left?: Node; right?: Node };
  function build(id: string, level: number): Node | undefined {
    const self = all.find((m) => m.id === id);
    if (!self) return undefined;
    const node: Node = { ...self };
    if (level < depth) {
      const kids = childrenByParent.get(id) ?? [];
      node.left = kids.find((k) => k.treeSide === "LEFT") && build(kids.find((k) => k.treeSide === "LEFT")!.id, level + 1);
      node.right = kids.find((k) => k.treeSide === "RIGHT") && build(kids.find((k) => k.treeSide === "RIGHT")!.id, level + 1);
    }
    return node;
  }
  return build(rootMemberId, 0);
}
