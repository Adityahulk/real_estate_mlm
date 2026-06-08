import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { SideNav } from "@/components/nav";
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
  { href: "/admin/business-plan", label: "Business Plan" },
  { href: "/admin/draws", label: "Lucky Draw" },
  { href: "/admin/operations", label: "Operations" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = getAdminSession();
  if (!session) redirect("/login");
  const root = await prisma.member.findFirst({
    where: { NOT: { memberId: "COMPANY" } },
    select: { leftTeamCount: true, rightTeamCount: true, rank: true },
    orderBy: { joinDate: "asc" },
  });

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card shadow-sm">
        <div className="brand-rule" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Brand href="/admin" compact />
            <span className="border-l pl-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Admin Panel</span>
          </div>
          <form action={logoutAdminAction}>
            <Button size="sm" variant="outline">Logout</Button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <SideNav
            items={items}
            title="Admin"
            matrix={{ label: "Root Matrix", left: root?.leftTeamCount ?? 0, right: root?.rightTeamCount ?? 0, rank: root?.rank ?? "NONE" }}
          />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-md border border-l-2 border-l-brand bg-card px-3 py-1.5 text-xs font-semibold">
                {i.label}
              </Link>
            ))}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
