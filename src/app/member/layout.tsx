import Link from "next/link";
import { currentMember } from "@/lib/services/queries";
import { SideNav } from "@/components/nav";
import { logoutMemberAction } from "@/server/auth-actions";
import { Button } from "@/components/ui";

const items = [
  { href: "/member", label: "Dashboard" },
  { href: "/member/kyc", label: "KYC" },
  { href: "/member/plot", label: "My Plot" },
  { href: "/member/payments", label: "Payments & EMI" },
  { href: "/member/commissions", label: "Points & Income" },
  { href: "/member/tree", label: "My Team" },
  { href: "/member/referral", label: "Refer & Earn" },
];

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const member = await currentMember();
  return (
    <div className="min-h-screen">
      <header className="bg-brand-gradient text-brand-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/member" className="font-semibold">Shree Shyam Villa – 2</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">
              {member.fullName} · <strong>{member.memberId}</strong>
            </span>
            <form action={logoutMemberAction}>
              <Button size="sm" variant="outline" className="border-white/50 bg-white/10 text-brand-foreground">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <SideNav items={items} title="Menu" />
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
