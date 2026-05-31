import { prisma } from "@/lib/db";
import { approveKycAction, rejectKycFormAction } from "@/server/admin-actions";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/components/ui";

export default async function KycReviewPage() {
  const pending = await prisma.member.findMany({
    where: { kycStatus: "PENDING" },
    include: { kyc: true },
    orderBy: { updatedAt: "asc" },
  });

  if (pending.length === 0) {
    return <Card className="p-6 text-sm text-muted-foreground">No pending KYC reviews. 🎉</Card>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">KYC Review ({pending.length})</h1>
      {pending.map((m) => {
        const k = m.kyc;
        const docs = [
          { label: "Aadhaar Front", url: k?.aadhaarFrontUrl },
          { label: "Aadhaar Back", url: k?.aadhaarBackUrl },
          { label: "PAN Card", url: k?.panCardUrl },
          { label: "Profile Photo", url: k?.profilePhotoUrl },
        ].filter((d) => d.url);
        return (
          <Card key={m.id}>
            <CardHeader><CardTitle>{m.memberId} · {m.fullName}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-1 sm:grid-cols-2">
                <div>Mobile: <b>{m.mobile}</b></div>
                <div>Email: <b>{m.email}</b></div>
                <div>Bank: <b>{k?.bankName ?? "-"}</b> · A/c ****{k?.accountLast4 ?? "----"}</div>
                <div>IFSC: <b>{k?.ifscCode ?? "-"}</b></div>
                <div>Nominee: <b>{k?.nomineeName ?? "-"}</b> ({k?.nomineeRelation ?? "-"})</div>
                <div>Nominee Phone: <b>{k?.nomineePhone ?? "-"}</b></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {docs.length === 0 && <span className="text-muted-foreground">No documents uploaded.</span>}
                {docs.map((d) => (
                  <a key={d.label} href={d.url!} target="_blank" className="rounded-lg border px-3 py-1.5 text-xs font-medium text-brand-foreground underline">
                    {d.label}
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                <form action={approveKycAction.bind(null, m.id)}>
                  <Button type="submit" variant="success">Approve</Button>
                </form>
                <form action={rejectKycFormAction} className="flex items-end gap-2">
                  <input type="hidden" name="memberId" value={m.id} />
                  <Input name="reason" placeholder="Rejection reason" className="w-56" />
                  <Button type="submit" variant="danger">Reject</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
