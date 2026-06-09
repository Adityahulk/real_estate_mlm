import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SETTING_DEFAULTS, SETTING_META } from "../src/lib/settings";
import { DEFAULT_COMMISSION_RULES } from "../src/lib/engines/commissionRules";

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === "production";
const adminEmail = process.env.SEED_ADMIN_EMAIL || (isProduction ? "" : "admin@shreeshyam.group");
const adminPassword = process.env.SEED_ADMIN_PASSWORD || (isProduction ? "" : "ShreeShyam@2026");

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
      update: {},
    });
  }

  // 3. Admin user
  const existingAdmin = adminEmail
    ? await prisma.user.findUnique({ where: { email: adminEmail } })
    : await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!existingAdmin) {
    if (!adminEmail || !adminPassword) {
      throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required to create the initial production admin");
    }
    await prisma.user.create({
      data: {
        name: "Super Admin",
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: "SUPER_ADMIN",
      },
    });
  }

  console.log(`Seed complete. No demo members or plots created.${existingAdmin ? " Existing admin preserved." : " Initial admin created."}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
