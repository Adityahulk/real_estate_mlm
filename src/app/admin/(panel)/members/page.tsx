import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge, Input } from "@/components/ui";

const kycTone = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", NOT_STARTED: "neutral" } as const;

export default async function MembersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const members = await prisma.member.findMany({
    where: {
      NOT: { memberId: "COMPANY" },
      ...(q
        ? { OR: [{ memberId: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }, { mobile: { contains: q } }] }
        : {}),
    },
    orderBy: { joinDate: "desc" },
    take: 200,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members ({members.length})</CardTitle>
        <form className="mt-2" action="/admin/members">
          <Input name="q" defaultValue={q} placeholder="Search by ID, name, or mobile…" className="max-w-xs" />
        </form>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Member ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Mobile</th>
              <th className="px-4 py-2">KYC</th>
              <th className="px-4 py-2">Rank</th>
              <th className="px-4 py-2">L / R</th>
              <th className="px-4 py-2">Directs</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{m.memberId}</td>
                <td className="px-4 py-2">{m.fullName}</td>
                <td className="px-4 py-2">{m.mobile}</td>
                <td className="px-4 py-2"><Badge tone={kycTone[m.kycStatus]}>{m.kycStatus.replace("_", " ")}</Badge></td>
                <td className="px-4 py-2"><Badge tone={m.rank === "BRONZE" ? "brand" : "neutral"}>{m.rank}</Badge></td>
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
