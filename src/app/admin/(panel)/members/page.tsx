import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, Select, Stat } from "@/components/ui";
import { downlineTree } from "@/lib/services/queries";

const kycTone = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", NOT_STARTED: "neutral" } as const;
const rankTone = { NONE: "neutral", BRONZE: "brand", SILVER: "success", GOLD: "warning" } as const;
type TreeNode = Awaited<ReturnType<typeof downlineTree>>;

function MemberTreeNode({ node }: { node: TreeNode }) {
  if (!node) return <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">empty</div>;
  const color =
    node.rank === "GOLD"
      ? "border-warning bg-warning/10"
      : node.rank === "SILVER"
        ? "border-success bg-success/10"
        : node.rank === "BRONZE"
          ? "border-brand bg-brand/10"
          : "border-border bg-card";
  return (
    <div className="flex flex-col items-center">
      <div className={`min-w-32 rounded-md border px-3 py-2 text-center ${color}`}>
        <div className="text-sm font-black">{node.memberId}</div>
        <div className="max-w-32 truncate text-xs text-muted-foreground">{node.fullName}</div>
        {node.rank !== "NONE" && <div className="mt-1 text-[10px] font-bold text-brand">{node.rank}</div>}
        <div className="text-[10px] text-muted-foreground">Matrix L {node.leftTeamCount} · R {node.rightTeamCount}</div>
      </div>
      {(node.left || node.right) && (
        <div className="mt-4 flex gap-4">
          <MemberTreeNode node={node.left as TreeNode} />
          <MemberTreeNode node={node.right as TreeNode} />
        </div>
      )}
    </div>
  );
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; root?: string; depth?: string }> }) {
  const params = await searchParams;
  const view = params.view ?? "tree";
  const q = params.q?.trim();
  const depth = Math.min(Math.max(Number(params.depth ?? 4), 1), 7);

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
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  }

  const root = params.root
    ? await prisma.member.findFirst({ where: { memberId: { equals: params.root, mode: "insensitive" }, NOT: { memberId: "COMPANY" } } })
    : await prisma.member.findFirst({ where: { NOT: { memberId: "COMPANY" } }, orderBy: { joinDate: "asc" } });
  const tree = root ? await downlineTree(root.id, depth) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase">Member Tree</h1>
          <p className="text-sm text-muted-foreground">Admin default view is tree format. Use list only when you need table/search details.</p>
        </div>
        <Link href="/admin/members?view=list"><Button variant="outline">Open Member List</Button></Link>
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
            <Input name="root" defaultValue={params.root ?? root?.memberId ?? ""} placeholder="Root Member ID, e.g. P001" />
            <Select name="depth" defaultValue={String(depth)}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} level(s)</option>)}
            </Select>
            <Button type="submit">Show Tree</Button>
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex min-w-max justify-center py-4">
            {tree ? <MemberTreeNode node={tree} /> : <div className="text-sm text-muted-foreground">No members found.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
