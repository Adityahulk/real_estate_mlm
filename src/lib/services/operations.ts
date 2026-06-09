import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { generateCashbackSchedule } from "../engines/emi";
import { unlockedPairRewards, visibleRank } from "../engines/eligibility";
import { getNumberSetting } from "../settings";

export async function createCashbackCreditsTx(
  tx: Prisma.TransactionClient,
  memberId: string,
  plotPrice: Prisma.Decimal,
  startDate = new Date()
) {
  const ratePct = await getNumberSetting("cashback_rate_pct");
  const months = await getNumberSetting("cashback_months");
  const rows = generateCashbackSchedule({ plotPrice: plotPrice.toNumber(), ratePct, months, startDate });
  await tx.cashbackCredit.createMany({
    data: rows.map((row) => ({
      memberId,
      monthNo: row.monthNo,
      amount: new Prisma.Decimal(row.amount.toFixed(2)),
      creditDate: row.creditDate,
    })),
    skipDuplicates: true,
  });
}

export async function processDueCashbacks() {
  const due = await prisma.cashbackCredit.findMany({
    where: { status: "PENDING", creditDate: { lte: new Date() } },
  });
  if (!due.length) return { processed: 0 };
  await prisma.cashbackCredit.updateMany({
    where: { id: { in: due.map((row) => row.id) } },
    data: { status: "PAID", paidAt: new Date() },
  });
  return { processed: due.length };
}

export async function updateEmiStatusesAndReminders() {
  const now = new Date();
  const upcoming = await prisma.emiSchedule.findMany({
    where: { status: { in: ["UPCOMING", "DUE"] } },
    include: { member: true },
  });
  let reminders = 0;
  for (const emi of upcoming) {
    const nextStatus = emi.dueDate < now ? "OVERDUE" : emi.payByDate <= now ? "DUE" : "UPCOMING";
    if (nextStatus !== emi.status) {
      await prisma.emiSchedule.update({ where: { id: emi.id }, data: { status: nextStatus } });
    }
    const days = Math.ceil((emi.payByDate.getTime() - now.getTime()) / 86400000);
    if ([7, 3, 1].includes(days)) {
      const exists = await prisma.notification.findFirst({
        where: {
          memberId: emi.memberId,
          type: "EMI_REMINDER",
          message: { contains: `EMI #${emi.installmentNo}` },
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        },
      });
      if (!exists) {
        await prisma.notification.create({
          data: {
            memberId: emi.memberId,
            type: "EMI_REMINDER",
            title: "EMI reminder",
            message: `EMI #${emi.installmentNo} is due in ${days} day(s).`,
            channel: "IN_APP",
            status: "PENDING",
          },
        });
        reminders++;
      }
    }
  }
  return { checked: upcoming.length, reminders };
}

export async function syncPairRewards(memberId: string) {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  const rewards = unlockedPairRewards(member.leftTeamCount, member.rightTeamCount);
  for (const type of rewards) {
    await prisma.pairRewardRecord.upsert({
      where: { memberId_type: { memberId, type } },
      create: { memberId, type },
      update: {},
    });
  }
  const bronzeMinReferrals = await getNumberSetting("bronze_min_referrals");
  const rank = visibleRank({
    directReferralCount: member.directReferralCount,
    bronzeMinReferrals,
    leftCount: member.leftTeamCount,
    rightCount: member.rightTeamCount,
  });
  if (rank !== member.rank) {
    await prisma.member.update({ where: { id: member.id }, data: { rank } });
  }
  return rewards;
}

export async function syncAllPairRewards() {
  const members = await prisma.member.findMany({ where: { NOT: { memberId: "COMPANY" } }, select: { id: true } });
  for (const member of members) await syncPairRewards(member.id);
  return { checked: members.length };
}

export async function transferMemberPlot(args: {
  memberId: string;
  newFullName: string;
  newMobile: string;
  newEmail: string;
  newPasswordHash: string;
  processedById: string;
}) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUniqueOrThrow({ where: { id: args.memberId } });
    await tx.plotTransfer.create({
      data: {
        memberId: member.id,
        previousFullName: member.fullName,
        previousMobile: member.mobile,
        previousEmail: member.email,
        newFullName: args.newFullName,
        newMobile: args.newMobile,
        newEmail: args.newEmail,
        processedById: args.processedById,
      },
    });
    return tx.member.update({
      where: { id: member.id },
      data: {
        fullName: args.newFullName,
        mobile: args.newMobile,
        whatsapp: args.newMobile,
        email: args.newEmail,
        passwordHash: args.newPasswordHash,
        kycStatus: "NOT_STARTED",
        isDrawEligible: false,
      },
    });
  });
}

export async function approveInsuranceClaim(claimId: string, reviewedById: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.insuranceClaim.findUniqueOrThrow({ where: { id: claimId } });
    const minMonths = await getNumberSetting("insurance_min_months");
    const deathType = claim.deathType.toLowerCase();
    if (!deathType.includes("accidental") && !deathType.includes("normal")) {
      throw new Error("Only accidental or normal death is eligible");
    }
    if (claim.monthsPaid < minMonths) throw new Error(`At least ${minMonths} paid months are required`);
    await tx.insuranceClaim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", reviewedById, reviewedAt: new Date() },
    });
    await tx.emiSchedule.updateMany({
      where: { memberId: claim.memberId, status: { in: ["UPCOMING", "DUE", "OVERDUE"] } },
      data: { status: "WAIVED" },
    });
    return tx.member.update({ where: { id: claim.memberId }, data: { isActive: false } });
  });
}
