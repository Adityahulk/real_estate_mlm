import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const adminEmail = process.env.RESET_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.RESET_ADMIN_PASSWORD;
const confirmed = process.env.CONFIRM_PRODUCTION_RESET === "DELETE_ALL_CUSTOMER_DATA";

async function main() {
  if (!confirmed) {
    throw new Error("Set CONFIRM_PRODUCTION_RESET=DELETE_ALL_CUSTOMER_DATA to run this destructive reset");
  }
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error("Set RESET_ADMIN_EMAIL and RESET_ADMIN_PASSWORD with a password of at least 12 characters");
  }

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog",
      "OtpCode",
      "Notification",
      "InsuranceClaim",
      "DrawWinner",
      "DrawEvent",
      "CommissionLedger",
      "Payout",
      "Payment",
      "PlotTransfer",
      "PairRewardRecord",
      "CashbackCredit",
      "EmiSchedule",
      "MemberKyc",
      "MemberApplication",
      "Member",
      "Plot",
      "User"
    RESTART IDENTITY CASCADE
  `);

  await prisma.user.create({
    data: {
      name: "Super Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  await prisma.member.create({
    data: {
      memberId: "COMPANY",
      fullName: "Shree Shyam Group",
      mobile: "0000000000",
      passwordHash: await bcrypt.hash(`system-${Date.now()}-${Math.random()}`, 10),
      isActive: true,
    },
  });

  const counts = {
    admins: await prisma.user.count(),
    customerMembers: await prisma.member.count({ where: { NOT: { memberId: "COMPANY" } } }),
    applications: await prisma.memberApplication.count(),
    plots: await prisma.plot.count(),
    payments: await prisma.payment.count(),
    payouts: await prisma.payout.count(),
    draws: await prisma.drawEvent.count(),
  };
  console.log("Production database cleaned successfully.");
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
