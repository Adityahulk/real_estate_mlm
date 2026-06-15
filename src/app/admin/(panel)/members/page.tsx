import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, Select, Stat, Field } from "@/components/ui";
import { downlineTree } from "@/lib/services/queries";
import { BinaryTree } from "@/components/binary-tree";
import { adminPasswordRecoveryAction, rebuildBinaryTreeAction, resetMemberPasswordAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";

const kycTone = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", NOT_STARTED: "neutral" } as const;
const rankTone = { NONE: "neutral", BRONZE: "brand", SILVER: "success", GOLD: "warning" } as const;
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; root?: string; depth?: string }> }) {
  const params = await searchParams;
  const view = params.view ?? "tree";
  const q = params.q?.trim();
  const depth = Math.min(Math.max(Number(params.depth ?? 7), 1), 7);

  if (view === "list") {
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
        NOT: { memberId: "COMPANY" },
        ...(q
          ? { OR: [{ memberId: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }, { mobile: { contains: q } }] }
          : {}),
      },
      include: {
        payments: { where: { paymentType: "BOOKING", status: "VERIFIED" }, select: { id: true }, take: 1 },
        sponsor: { select: { memberId: true } },
      },
      orderBy: { joinDate: "desc" },
      take: 200,
    });

    return (
      <div className="space-y-4">
        <MemberAdminTools />
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Member List ({members.length})</CardTitle>
              <Link href="/admin/members"><Button variant="outline">Open Tree</Button></Link>
            </div>
            <form className="mt-2" action="/admin/members">
              <input type="hidden" name="view" value="list" />
              <Input name="q" defaultValue={q} placeholder="Search by ID, name, or mobile..." className="max-w-xs" />
            </form>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Member ID</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Mobile</th>
                  <th className="px-4 py-2">Referrer</th>
                  <th className="px-4 py-2">Booking</th>
                  <th className="px-4 py-2">KYC</th>
                  <th className="px-4 py-2">Rank</th>
                  <th className="px-4 py-2">Matrix L / R</th>
                  <th className="px-4 py-2">Directs</th>
                  <th className="px-4 py-2">Set Password</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{m.memberId}</td>
                    <td className="px-4 py-2">{m.fullName}</td>
                    <td className="px-4 py-2">{m.mobile}</td>
                    <td className="px-4 py-2">{m.sponsor?.memberId ?? "-"}</td>
                    <td className="px-4 py-2"><Badge tone={m.payments.length ? "success" : "neutral"}>{m.payments.length ? "PAID" : "UNPAID"}</Badge></td>
                    <td className="px-4 py-2"><Badge tone={kycTone[m.kycStatus]}>{m.kycStatus.replace("_", " ")}</Badge></td>
                    <td className="px-4 py-2"><Badge tone={rankTone[m.rank]}>{m.rank}</Badge></td>
                    <td className="px-4 py-2">{m.leftTeamCount} / {m.rightTeamCount}</td>
                    <td className="px-4 py-2">{m.directReferralCount}</td>
                    <td className="px-4 py-2">
                      <form action={resetMemberPasswordAction} className="flex min-w-56 gap-2">
                        <input type="hidden" name="memberId" value={m.id} />
                        <Input name="password" type="password" minLength={6} placeholder="New password" />
                        <Button type="submit" size="sm">Set</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const root = params.root
    ? await prisma.member.findFirst({ where: { memberId: { equals: params.root, mode: "insensitive" }, plotId: { not: null }, NOT: { memberId: "COMPANY" } } })
    : await prisma.member.findFirst({ where: { plotId: { not: null }, NOT: { memberId: "COMPANY" } }, orderBy: { joinDate: "asc" } });
  const tree = root ? await downlineTree(root.id, depth) : undefined;

  return (
    <div className="space-y-4">
      <MemberAdminTools />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase">Member Tree</h1>
          <p className="text-sm text-muted-foreground">Admin default view is tree format. Use list only when you need table/search details.</p>
        </div>
        <Link href="/admin/members?view=list"><Button variant="outline">Open Member List</Button></Link>
        <form action={rebuildBinaryTreeAction}>
          <Button type="submit" variant="outline">Rebuild Tree Placement</Button>
        </form>
      </div>
      {root && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Root ID" value={root.memberId} />
          <Stat label="Rank" value={<Badge tone={rankTone[root.rank]}>{root.rank}</Badge>} />
          <Stat label="Matrix Left" value={root.leftTeamCount} />
          <Stat label="Matrix Right" value={root.rightTeamCount} />
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Tree Controls</CardTitle>
          <form action="/admin/members" className="mt-3 grid gap-3 sm:grid-cols-3">
            <Input name="root" defaultValue={params.root ?? root?.memberId ?? ""} placeholder="Root Member ID, e.g. SSV000001" />
            <Select name="depth" defaultValue={String(depth)}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} level(s)</option>)}
            </Select>
            <Button type="submit">Show Tree</Button>
          </form>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="flex justify-center py-4">
            <BinaryTree node={tree} maxDepth={depth} nodeHref={(memberId) => `/admin/members?root=${encodeURIComponent(memberId)}&depth=7`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberAdminTools() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password Recovery</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">Admin can issue a new password after verifying the member. Use the generated Member ID for the most reliable match.</p>
      </CardHeader>
      <CardContent>
        <StatefulForm action={adminPasswordRecoveryAction} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
          <Field label="Member ID / Mobile / Email">
            <Input name="memberLookup" placeholder="SSV000001 or 9876543210" />
          </Field>
          <Field label="New Password">
            <Input name="newPassword" type="password" minLength={6} placeholder="At least 6 characters" />
          </Field>
          <div className="flex items-end pb-3">
            <SubmitButton className="w-full sm:w-auto" pendingText="Resetting...">Reset Password</SubmitButton>
          </div>
        </StatefulForm>
      </CardContent>
    </Card>
  );
}
