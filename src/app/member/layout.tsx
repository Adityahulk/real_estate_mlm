import { currentMember } from "@/lib/services/queries";
import { MobileNav, SideNav } from "@/components/nav";
import { logoutMemberAction } from "@/server/auth-actions";
import { Button } from "@/components/ui";
import { Brand } from "@/components/brand";

const items = [
  { href: "/member", label: "Dashboard" },
  { href: "/member/kyc", label: "KYC" },
  { href: "/member/plot", label: "My Plot" },
  { href: "/member/payments", label: "Payments & EMI" },
  { href: "/member/commissions", label: "Points & Income" },
  { href: "/member/draws", label: "Lucky Draw" },
  { href: "/member/insurance", label: "Insurance" },
  { href: "/member/notifications", label: "Notifications" },
  { href: "/member/rewards", label: "Rank & Rewards" },
  { href: "/member/tree", label: "My Team" },
  { href: "/member/referral", label: "Refer & Earn" },
];

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const member = await currentMember();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card shadow-sm">
        <div className="brand-rule" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <Brand href="/member" compact />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">
              {member.fullName} · <strong>{member.memberId}</strong> · {member.mobile}
            </span>
            <MobileNav items={items} title="Member Menu" />
            <form action={logoutMemberAction}>
              <Button size="sm" variant="outline">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-3 py-4 sm:px-4 sm:py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <SideNav items={items} title="Menu" matrix={{ label: "Matching Matrix", left: member.leftTeamCount, right: member.rightTeamCount, rank: member.rank }} />
        </aside>
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
