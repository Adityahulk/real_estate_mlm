import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SETTING_DEFAULTS, SETTING_META } from "../src/lib/settings";
import { DEFAULT_COMMISSION_RULES } from "../src/lib/engines/commissionRules";
import { registerMember, COMPANY_ROOT_MEMBER_ID } from "../src/lib/services/members";
import { confirmPayment } from "../src/lib/services/payments";
import { isBronze } from "../src/lib/engines/eligibility";

const prisma = new PrismaClient();

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
    where: { email: "admin@ssv.local" },
    create: {
      name: "Super Admin",
      email: "admin@ssv.local",
      phone: "9898774296",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "SUPER_ADMIN",
    },
    update: {},
  });

  // 4. Company root member (tree root; not a plot owner)
  await prisma.member.upsert({
    where: { memberId: COMPANY_ROOT_MEMBER_ID },
    create: {
      memberId: COMPANY_ROOT_MEMBER_ID,
      fullName: "Shree Shyam Villa (Company)",
      mobile: "0000000000",
      email: "company@ssv.local",
      passwordHash: await bcrypt.hash("disabled", 10),
      treeLevel: 0,
      kycStatus: "APPROVED",
      isActive: true,
    },
    update: {},
  });

  // 5. Plots P001..P020
  const plotCount = await prisma.plot.count();
  if (plotCount === 0) {
    for (let i = 1; i <= 20; i++) {
      const n = String(i).padStart(3, "0");
      await prisma.plot.create({
        data: {
          plotNumber: `P${n}`,
          plotSize: "12x36",
          plotPrice: new Prisma.Decimal("300240"),
          developmentCharges: new Prisma.Decimal("25000"),
          documentationCharges: new Prisma.Decimal("15000"),
          locationBlock: `Block ${String.fromCharCode(65 + ((i - 1) % 3))}`,
          rowNumber: String(Math.ceil(i / 3)),
          roadFacing: i % 4 === 0,
        },
      });
    }
  }

  // 6. Demo member sponsor chain (only if no real members yet)
  const memberCount = await prisma.member.count({ where: { NOT: { memberId: COMPANY_ROOT_MEMBER_ID } } });
  if (memberCount === 0) {
    const demo = [
      { fullName: "Rajesh Patel", mobile: "9000000001", email: "rajesh@demo.local", sponsor: undefined as string | undefined },
      { fullName: "Dinesh Verma", mobile: "9000000002", email: "dinesh@demo.local", sponsor: "P001" },
      { fullName: "Suresh Shah", mobile: "9000000003", email: "suresh@demo.local", sponsor: "P002" },
      { fullName: "Mahesh Joshi", mobile: "9000000004", email: "mahesh@demo.local", sponsor: "P003" },
      { fullName: "Kiran Desai", mobile: "9000000005", email: "kiran@demo.local", sponsor: "P003" },
    ];
    for (const d of demo) {
      const m = await registerMember({
        fullName: d.fullName,
        aadhaarNumber: "999988887777",
        mobile: d.mobile,
        email: d.email,
        password: "member123",
        sponsorMemberId: d.sponsor,
        paymentPlan: "INSTALLMENT",
      });
      const payment = await prisma.payment.create({
        data: {
          memberId: m.id,
          paymentType: "BOOKING",
          amount: new Prisma.Decimal("10000"),
          paymentMode: "OFFLINE",
          referenceNumber: `DEMO-BOOKING-${m.memberId}`,
          status: "PENDING",
        },
      });
      await confirmPayment(payment.id);

      // Approve demo accounts so local logins work; real registrations remain
      // inactive until admin verifies booking and approves them.
      await prisma.member.update({
        where: { id: m.id },
        data: { kycStatus: "APPROVED", isActive: true, isDrawEligible: true },
      });
      if (d.sponsor) {
        const sponsor = await prisma.member.findUnique({ where: { memberId: d.sponsor } });
        if (sponsor) {
          const updated = await prisma.member.update({
            where: { id: sponsor.id },
            data: { directReferralCount: { increment: 1 } },
          });
          if (isBronze(updated.directReferralCount, Number(SETTING_DEFAULTS.bronze_min_referrals))) {
            await prisma.member.update({ where: { id: sponsor.id }, data: { rank: "BRONZE" } });
          }
        }
      }
    }
  }

  console.log("Seed complete. Admin: admin@ssv.local / admin123. Demo members: 9000000001-9000000005 / member123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
