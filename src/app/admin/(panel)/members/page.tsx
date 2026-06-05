import { prisma } from "@/lib/db";
import { approveMemberAction } from "@/server/admin-actions";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from "@/components/ui";

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
    include: {
      payments: {
        where: { paymentType: "BOOKING", status: "VERIFIED" },
        select: { id: true },
        take: 1,
      },
      sponsor: { select: { memberId: true } },
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
              <th className="px-4 py-2">Referrer</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Booking</th>
              <th className="px-4 py-2">KYC</th>
              <th className="px-4 py-2">Rank</th>
              <th className="px-4 py-2">L / R</th>
              <th className="px-4 py-2">Directs</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const bookingPaid = m.payments.length > 0;
              return (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{m.memberId}</td>
                  <td className="px-4 py-2">{m.fullName}</td>
                  <td className="px-4 py-2">{m.mobile}</td>
                  <td className="px-4 py-2">{m.sponsor?.memberId ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge tone={m.isActive ? "success" : "warning"}>{m.isActive ? "ACTIVE" : "PENDING"}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={bookingPaid ? "success" : "neutral"}>{bookingPaid ? "PAID" : "UNPAID"}</Badge>
                  </td>
                  <td className="px-4 py-2"><Badge tone={kycTone[m.kycStatus]}>{m.kycStatus.replace("_", " ")}</Badge></td>
                  <td className="px-4 py-2"><Badge tone={m.rank === "BRONZE" ? "brand" : "neutral"}>{m.rank}</Badge></td>
                  <td className="px-4 py-2">{m.leftTeamCount} / {m.rightTeamCount}</td>
                  <td className="px-4 py-2">{m.directReferralCount}</td>
                  <td className="px-4 py-2 text-right">
                    {!m.isActive && (
                      <form action={approveMemberAction.bind(null, m.id)}>
                        <Button size="sm" type="submit" disabled={!bookingPaid}>Approve</Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
