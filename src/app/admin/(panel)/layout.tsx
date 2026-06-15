import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { MobileNav, SideNav } from "@/components/nav";
import { logoutAdminAction } from "@/server/auth-actions";
import { Button } from "@/components/ui";
import { Brand } from "@/components/brand";
import { prisma } from "@/lib/db";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/kyc", label: "KYC Review" },
  { href: "/admin/plots", label: "Plots" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/requests", label: "Member Requests" },
  { href: "/admin/business-plan", label: "Business Plan" },
  { href: "/admin/draws", label: "Lucky Draw" },
  { href: "/admin/operations", label: "Operations" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  const [admin, root] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.sub }, select: { isActive: true } }),
    prisma.member.findFirst({
      where: { plotId: { not: null }, NOT: { memberId: "COMPANY" } },
      select: { leftTeamCount: true, rightTeamCount: true, rank: true },
      orderBy: { joinDate: "asc" },
    }),
  ]);
  if (!admin?.isActive) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card shadow-sm">
        <div className="brand-rule" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-3">
            <Brand href="/admin" compact />
            <span className="hidden border-l pl-3 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:inline">Admin Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <MobileNav items={items} title="Admin Menu" />
            <form action={logoutAdminAction}>
              <Button size="sm" variant="outline">Logout</Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-4 sm:px-4 sm:py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <SideNav
            items={items}
            title="Admin"
            matrix={{ label: "Root Matrix", left: root?.leftTeamCount ?? 0, right: root?.rightTeamCount ?? 0, rank: root?.rank ?? "NONE" }}
          />
        </aside>
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
