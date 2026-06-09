import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { submitInsuranceClaimAction } from "@/server/member-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Badge, Card, CardContent, CardHeader, CardTitle, Field, Input } from "@/components/ui";

export default async function InsurancePage() {
  const member = await currentMember();
  const claims = await prisma.insuranceClaim.findMany({ where: { memberId: member.id }, orderBy: { claimSubmittedAt: "desc" } });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Submit Insurance Claim</CardTitle></CardHeader>
        <CardContent>
          <StatefulForm action={submitInsuranceClaimAction}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Death Date"><Input name="deathDate" type="date" /></Field>
              <Field label="Death Type"><Input name="deathType" defaultValue="Accidental" placeholder="Accidental or Normal" /></Field>
              <Field label="Death Certificate"><Input name="deathCertificate" type="file" accept="image/*,.pdf" /></Field>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Insurance applies for accidental or normal death after at least 5 paid months. Nominee receives the plot according to policy conditions.
            </p>
            <SubmitButton>Submit Claim</SubmitButton>
          </StatefulForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Claim History</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {claims.map((claim) => <div key={claim.id} className="flex justify-between border-b py-2"><span>{claim.claimSubmittedAt.toISOString().slice(0, 10)} · {claim.deathType}</span><Badge tone={claim.status === "APPROVED" ? "success" : claim.status === "REJECTED" ? "danger" : "warning"}>{claim.status.replace("_", " ")}</Badge></div>)}
          {!claims.length && <div className="text-muted-foreground">No claims submitted.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
