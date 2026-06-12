import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SETTING_DEFAULTS, SETTING_META } from "../src/lib/settings";
import { DEFAULT_COMMISSION_RULES } from "../src/lib/engines/commissionRules";

const prisma = new PrismaClient();
const demoPassword = process.env.DEMO_MEMBER_PASSWORD || "123456";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.CONFIRM_DEMO_RESET !== "RESET_WITH_DEMO_MEMBER") {
    throw new Error("Demo reset is blocked in production. Set CONFIRM_DEMO_RESET=RESET_WITH_DEMO_MEMBER only when intentionally replacing production data.");
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
      "Plot"
    RESTART IDENTITY CASCADE
  `);

  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    const meta = SETTING_META[key as keyof typeof SETTING_META];
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, type: meta.type, label: meta.label },
      update: { value, type: meta.type, label: meta.label },
    });
  }
  for (const rule of DEFAULT_COMMISSION_RULES) {
    await prisma.commissionRule.upsert({
      where: { incomeType: rule.incomeType },
      create: {
        program: rule.incomeType.startsWith("LEVEL") ? "LEVEL" : "SPONSOR",
        incomeType: rule.incomeType,
        uplineDepth: rule.uplineDepth,
        fullAmount: new Prisma.Decimal(String(rule.fullAmount)),
        active: true,
      },
      update: {
        program: rule.incomeType.startsWith("LEVEL") ? "LEVEL" : "SPONSOR",
        uplineDepth: rule.uplineDepth,
        fullAmount: new Prisma.Decimal(String(rule.fullAmount)),
        active: true,
      },
    });
  }

  const company = await prisma.member.create({
    data: {
      memberId: "COMPANY",
      fullName: "Shree Shyam Group",
      mobile: "0000000000",
      passwordHash: await bcrypt.hash(`system-${Date.now()}-${Math.random()}`, 10),
      isActive: true,
    },
  });
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const demo = await prisma.member.create({
    data: {
      memberId: "SSV000001",
      fullName: "Demo Member",
      mobile: "9876543210",
      whatsapp: "9876543210",
      passwordHash,
      sponsorId: company.id,
      isActive: true,
    },
  });
  await prisma.memberApplication.create({
    data: {
      applicationCode: demo.memberId,
      fullName: demo.fullName,
      mobile: demo.mobile,
      whatsapp: demo.mobile,
      passwordHash,
      sponsorId: company.id,
      status: "PENDING",
    },
  });

  console.log("Demo reset complete.");
  console.log(`Member ID: ${demo.memberId}`);
  console.log(`Mobile: ${demo.mobile}`);
  console.log(`Password: ${demoPassword}`);
  console.log("Sponsor ID: COMPANY");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
