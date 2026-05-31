import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { SideNav } from "@/components/nav";
import { logoutAdminAction } from "@/server/auth-actions";
import { Button } from "@/components/ui";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/kyc", label: "KYC Review" },
  { href: "/admin/plots", label: "Plots" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-semibold">SSV Admin</Link>
          <form action={logoutAdminAction}>
            <Button size="sm" variant="outline">Logout</Button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <SideNav items={items} title="Admin" />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
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
