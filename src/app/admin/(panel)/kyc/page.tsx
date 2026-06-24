import { prisma } from "@/lib/db";
import { approveKycAction, rejectKycFormAction, updateMemberKycByAdminAction, allowMemberKycEditAction } from "@/server/admin-actions";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Field, Badge } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/form";
import { decryptPII } from "@/lib/crypto";

const kycTone = { APPROVED: "success", PENDING: "warning", REJECTED: "danger", NOT_STARTED: "neutral" } as const;

export default async function KycReviewPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim();
  const members = await prisma.member.findMany({
    where: {
      NOT: { memberId: "COMPANY" },
      ...(q
        ? {
            OR: [
              { memberId: { contains: q, mode: "insensitive" } },
              { fullName: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
            ],
          }
        : {}),
    },
    include: { kyc: true },
    orderBy: [{ kycStatus: "desc" }, { memberId: "asc" }],
    take: 200,
  });
  const pendingCount = members.filter((member) => member.kycStatus === "PENDING").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>KYC Records ({members.length})</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending reviews: {pendingCount}. Admin can view KYC for every member, approve/reject, edit details, or allow the member to edit from their panel.
          </p>
          <form action="/admin/kyc" className="mt-3">
            <Input name="q" defaultValue={q ?? ""} placeholder="Search by member ID, name, or mobile..." className="max-w-sm" />
          </form>
        </CardHeader>
      </Card>

      {members.map((m) => {
        const k = m.kyc;
        const accountNumber = decryptPII(k?.accountNumber);
        const docs = [
          { label: "Aadhaar Front", url: k?.aadhaarFrontUrl },
          { label: "Aadhaar Back", url: k?.aadhaarBackUrl },
          { label: "PAN Card", url: k?.panCardUrl },
          { label: "Profile Photo", url: k?.profilePhotoUrl },
        ];
        return (
          <Card key={m.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{m.memberId} · {m.fullName}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={kycTone[m.kycStatus]}>{m.kycStatus.replace("_", " ")}</Badge>
                  {k?.editAllowed && <Badge tone="brand">Edit Enabled</Badge>}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Mobile: {m.mobile} · Email: {m.email ?? "-"}</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>Bank: <b>{k?.bankName ?? "-"}</b></div>
                <div>Account Holder: <b>{k?.accountHolderName ?? "-"}</b></div>
                <div>Account Number: <b>{accountNumber ?? (k?.accountLast4 ? `****${k.accountLast4}` : "-")}</b></div>
                <div>IFSC: <b>{k?.ifscCode ?? "-"}</b></div>
                <div>Nominee: <b>{k?.nomineeName ?? "-"}</b> ({k?.nomineeRelation ?? "-"})</div>
                <div>Nominee Phone: <b>{k?.nomineePhone ?? "-"}</b></div>
              </div>

              <div className="flex flex-wrap gap-2">
                {docs.map((d) =>
                  d.url ? (
                    <a key={d.label} href={d.url} target="_blank" className="rounded-lg border px-3 py-1.5 text-xs font-medium text-brand-foreground underline">
                      {d.label}
                    </a>
                  ) : (
                    <span key={d.label} className="rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground">{d.label} missing</span>
                  ),
                )}
              </div>

              <StatefulForm action={updateMemberKycByAdminAction} className="rounded-lg border bg-muted/30 p-3">
                <input type="hidden" name="memberId" value={m.id} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Bank Name"><Input name="bankName" defaultValue={k?.bankName ?? ""} /></Field>
                  <Field label="Account Holder"><Input name="accountHolderName" defaultValue={k?.accountHolderName ?? ""} /></Field>
                  <Field label="Account Number"><Input name="accountNumber" defaultValue={accountNumber ?? ""} placeholder="Leave blank to keep current" /></Field>
                  <Field label="IFSC"><Input name="ifscCode" defaultValue={k?.ifscCode ?? ""} /></Field>
                  <Field label="Nominee Name"><Input name="nomineeName" defaultValue={k?.nomineeName ?? ""} /></Field>
                  <Field label="Relation"><Input name="nomineeRelation" defaultValue={k?.nomineeRelation ?? ""} /></Field>
                  <Field label="Nominee Mobile"><Input name="nomineePhone" defaultValue={k?.nomineePhone ?? ""} inputMode="numeric" /></Field>
                  <div className="flex items-end pb-3"><SubmitButton className="w-full" pendingText="Saving...">Save KYC Details</SubmitButton></div>
                </div>
              </StatefulForm>

              <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                {k ? (
                  <>
                    <form action={approveKycAction.bind(null, m.id)}>
                      <Button type="submit" variant="success">Approve KYC</Button>
                    </form>
                    <form action={rejectKycFormAction} className="flex items-end gap-2">
                      <input type="hidden" name="memberId" value={m.id} />
                      <Input name="reason" placeholder="Rejection reason" className="w-56" />
                      <Button type="submit" variant="danger">Reject</Button>
                    </form>
                    <form action={allowMemberKycEditAction.bind(null, m.id)}>
                      <Button type="submit" variant="outline">Allow Member Edit</Button>
                    </form>
                  </>
                ) : (
                  <form action={allowMemberKycEditAction.bind(null, m.id)}>
                    <Button type="submit" variant="outline">Create KYC & Allow Edit</Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!members.length && <Card className="p-6 text-sm text-muted-foreground">No members found.</Card>}
    </div>
  );
}
