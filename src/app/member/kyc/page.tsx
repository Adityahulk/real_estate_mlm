import { currentMember } from "@/lib/services/queries";
import { submitKycAction } from "@/server/member-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Field, Input, Badge } from "@/components/ui";

export default async function KycPage() {
  const me = await currentMember();

  if (me.kycStatus === "APPROVED") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Badge tone="success">APPROVED</Badge>
          <span className="font-medium">Your KYC is approved. You can make payments.</span>
        </div>
      </Card>
    );
  }

  if (me.kycStatus === "PENDING") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Badge tone="warning">PENDING</Badge>
          <span className="font-medium">Your documents are under review by the admin.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete KYC</CardTitle>
        {me.kyc?.rejectionReason && (
          <p className="mt-1 text-sm text-danger">Previously rejected: {me.kyc.rejectionReason}</p>
        )}
      </CardHeader>
      <CardContent>
        <StatefulForm action={submitKycAction}>
          <div className="mb-2 text-sm font-semibold">Documents</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Aadhaar Front"><Input type="file" name="aadhaarFront" accept="image/*,.pdf" /></Field>
            <Field label="Aadhaar Back"><Input type="file" name="aadhaarBack" accept="image/*,.pdf" /></Field>
            <Field label="PAN Card"><Input type="file" name="panCard" accept="image/*,.pdf" /></Field>
            <Field label="Profile Photo"><Input type="file" name="profilePhoto" accept="image/*" /></Field>
          </div>

          <div className="mb-2 mt-4 text-sm font-semibold">Bank Details (for payouts)</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank Name"><Input name="bankName" /></Field>
            <Field label="Account Holder Name"><Input name="accountHolderName" /></Field>
            <Field label="Account Number"><Input name="accountNumber" /></Field>
            <Field label="IFSC Code"><Input name="ifscCode" /></Field>
          </div>

          <div className="mb-2 mt-4 text-sm font-semibold">Nominee Details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nominee Name"><Input name="nomineeName" /></Field>
            <Field label="Relation"><Input name="nomineeRelation" /></Field>
            <Field label="Nominee Aadhaar"><Input name="nomineeAadhaar" inputMode="numeric" /></Field>
            <Field label="Nominee Phone"><Input name="nomineePhone" inputMode="numeric" /></Field>
          </div>

          <SubmitButton className="mt-4 w-full sm:w-auto">Submit for Review</SubmitButton>
        </StatefulForm>
      </CardContent>
    </Card>
  );
}
