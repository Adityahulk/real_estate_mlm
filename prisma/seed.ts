import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SETTING_DEFAULTS, SETTING_META } from "../src/lib/settings";
import { DEFAULT_COMMISSION_RULES } from "../src/lib/engines/commissionRules";

const prisma = new PrismaClient();
const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@shreeshyam.group";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ShreeShyam@2026";

async function main() {
  // 1. System settings
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    const meta = SETTING_META[key as keyof typeof SETTING_META];
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, type: meta.type, label: meta.label },
      update: {}, // don't clobber admin edits
    });
  }

  // 2. Commission rules
  for (const r of DEFAULT_COMMISSION_RULES) {
    await prisma.commissionRule.upsert({
      where: { incomeType: r.incomeType },
      create: {
        program: r.incomeType.startsWith("LEVEL") ? "LEVEL" : "SPONSOR",
        incomeType: r.incomeType,
        uplineDepth: r.uplineDepth,
        fullAmount: new Prisma.Decimal(String(r.fullAmount)),
        active: true,
      },
      update: {
        uplineDepth: r.uplineDepth,
        fullAmount: new Prisma.Decimal(String(r.fullAmount)),
        program: r.incomeType.startsWith("LEVEL") ? "LEVEL" : "SPONSOR",
        active: true,
      },
    });
  }

  // 3. Admin user
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: "Super Admin",
      email: adminEmail,
      phone: "9898774296",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "SUPER_ADMIN",
    },
    update: {
      name: "Super Admin",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log(`Seed complete. Admin: ${adminEmail} / ${adminPassword}. No demo members or plots created.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
