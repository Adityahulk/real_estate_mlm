import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { randomSource, notifier } from "../integrations";
import { formatINR } from "../money";
import { getNumberSetting } from "../settings";

export interface DrawPrize {
  name: string;
  value?: number;
}

export const DEFAULT_DRAW_PRIZES: DrawPrize[] = [
  { name: "12x36 Plot" },
  { name: "Mixer Grinder" },
  { name: "Iron Press" },
  { name: "Pressure Cooker" },
  { name: "Tea Cup Set" },
];

export function parseDrawPrizes(input: string): DrawPrize[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nameRaw, valueRaw] = line.split("|").map((part) => part.trim());
      if (!nameRaw) throw new Error("Every prize must have a name");
      const value = valueRaw ? Number(valueRaw) : undefined;
      if (valueRaw && (!Number.isFinite(value) || value! < 0)) {
        throw new Error(`Invalid prize value for ${nameRaw}`);
      }
      return { name: nameRaw, value };
    });
}

export async function eligibleDrawMembers() {
  const [bookedPlots, triggerPlots] = await Promise.all([
    prisma.plot.count({ where: { status: { in: ["BOOKED", "SOLD", "DRAW_WON"] } } }),
    getNumberSetting("draw_trigger_plots"),
  ]);
  if (bookedPlots < triggerPlots) return [];

  const now = new Date();
  const windowEnd = new Date(now.getFullYear(), now.getMonth(), 5, 23, 59, 59, 999);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 1, 25, 0, 0, 0, 0);

  return prisma.member.findMany({
    where: {
      isActive: true,
      kycStatus: "APPROVED",
      NOT: { memberId: "COMPANY" },
      payments: {
        some: {
          status: "VERIFIED",
          paymentDate: { gte: windowStart, lte: windowEnd },
        },
      },
    },
    include: {
      sponsor: { select: { id: true, memberId: true, fullName: true } },
      plot: { select: { plotNumber: true } },
    },
    orderBy: { joinDate: "asc" },
  });
}

export async function conductDraw(args: { conductedById: string; prizes?: DrawPrize[] }) {
  const prizes = args.prizes ?? DEFAULT_DRAW_PRIZES;
  if (!prizes.length) throw new Error("Enter at least one prize");

  const eligible = await eligibleDrawMembers();
  if (!eligible.length) throw new Error("No eligible members are available for the draw");
  if (prizes.length > eligible.length) {
    throw new Error(`Only ${eligible.length} eligible member(s) are available`);
  }

  const picked = await randomSource.pick(prizes.length, eligible.length);
  const winners = picked.indices.map((index, prizeIndex) => ({
    member: eligible[index],
    prize: prizes[prizeIndex],
    prizeRank: prizeIndex + 1,
  }));
  const latest = await prisma.drawEvent.aggregate({ _max: { drawNumber: true } });
  const drawNumber = (latest._max.drawNumber ?? 0) + 1;

  const draw = await prisma.$transaction(async (tx) => {
    const event = await tx.drawEvent.create({
      data: {
        drawNumber,
        drawDate: new Date(),
        status: "COMPLETED",
        eligibleCount: eligible.length,
        conductedById: args.conductedById,
        randomSeed: picked.seed,
      },
    });

    for (const winner of winners) {
      await tx.drawWinner.create({
        data: {
          drawEventId: event.id,
          memberId: winner.member.id,
          sponsorId: winner.member.sponsorId,
          prizeRank: winner.prizeRank,
          prizeName: winner.prize.name,
          prizeValue:
            winner.prize.value === undefined
              ? undefined
              : new Prisma.Decimal(winner.prize.value),
          status: "WON",
        },
      });
      await tx.notification.create({
        data: {
          memberId: winner.member.id,
          type: "DRAW_RESULT",
          title: `Lucky Draw #${drawNumber} Winner`,
          message: `Congratulations! You won ${winner.prize.name}.`,
          channel: "WHATSAPP",
          status: "SENT",
          sentAt: new Date(),
        },
      });

      if (winner.prizeRank === 1) {
        if (winner.member.plotId) {
          await tx.plot.update({
            where: { id: winner.member.plotId },
            data: { status: "DRAW_WON" },
          });
        }
        await tx.emiSchedule.updateMany({
          where: { memberId: winner.member.id, status: { in: ["UPCOMING", "DUE", "OVERDUE"] } },
          data: { status: "WAIVED" },
        });

        const sponsor = winner.member.sponsorId
          ? await tx.member.findUnique({ where: { id: winner.member.sponsorId } })
          : null;
        if (sponsor?.rank === "BRONZE") {
          await tx.drawWinner.create({
            data: {
              drawEventId: event.id,
              memberId: sponsor.id,
              sponsorId: sponsor.sponsorId,
              prizeRank: 1,
              prizeName: `${winner.prize.name} - Bronze Sponsor Bonus`,
              prizeValue: winner.prize.value === undefined ? undefined : new Prisma.Decimal(winner.prize.value),
              status: "WON",
            },
          });
          await tx.notification.create({
            data: {
              memberId: sponsor.id,
              type: "DRAW_RESULT",
              title: `Lucky Draw #${drawNumber} Bronze Bonus`,
              message: `Your direct referral won first prize, so you also receive ${winner.prize.name}.`,
              channel: "WHATSAPP",
              status: "SENT",
              sentAt: new Date(),
            },
          });
        }
      }
    }

    return event;
  });

  for (const winner of winners) {
    const valueText =
      winner.prize.value === undefined ? "" : ` worth ${formatINR(winner.prize.value)}`;
    await notifier.send({
      channel: "WHATSAPP",
      to: winner.member.whatsapp ?? winner.member.mobile,
      title: `Lucky Draw #${drawNumber} Winner`,
      message: `Congratulations! You won ${winner.prize.name}${valueText}.`,
    });
  }

  return { draw, winners };
}

export async function markDrawPrizeClaimed(winnerId: string) {
  return prisma.drawWinner.update({
    where: { id: winnerId },
    data: { status: "CLAIMED", claimedAt: new Date() },
  });
}
