import { currentMember } from "@/lib/services/queries";
import { submitKycAction } from "@/server/member-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Field, Input, Badge } from "@/components/ui";

export default async function KycPage() {
  const me = await currentMember();
  const canEdit = me.kyc?.editAllowed;

  if (me.kycStatus === "APPROVED" && !canEdit) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Badge tone="success">APPROVED</Badge>
          <span className="font-medium">Your KYC is approved. Your income payouts can be released.</span>
        </div>
      </Card>
    );
  }

  if (me.kycStatus === "PENDING" && !canEdit) {
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
        <CardTitle>{canEdit ? "Edit KYC" : "Complete KYC"}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">Upload Aadhaar, PAN, bank details, and nominee details. After you submit, admin will review and approve it for payouts.</p>
        {me.kyc?.rejectionReason && (
          <p className="mt-1 text-sm text-danger">Previously rejected: {me.kyc.rejectionReason}</p>
        )}
        {canEdit && <p className="mt-1 text-sm text-brand-foreground">Admin has enabled editing for this KYC record.</p>}
      </CardHeader>
      <CardContent>
        <StatefulForm action={submitKycAction}>
          <div className="mb-2 text-sm font-semibold">Documents</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Aadhaar Front"><Input type="file" name="aadhaarFront" accept="image/*,.pdf" /></Field>
            <Field label="Aadhaar Back"><Input type="file" name="aadhaarBack" accept="image/*,.pdf" /></Field>
            <Field label="PAN Card"><Input type="file" name="panCard" accept="image/*,.pdf" /></Field>
            <Field label="Profile Photo (optional)"><Input type="file" name="profilePhoto" accept="image/*" /></Field>
          </div>

        <div className="mb-2 mt-4 text-sm font-semibold">Bank Details (for payouts)</div>
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank Name"><Input name="bankName" defaultValue={me.kyc?.bankName ?? ""} /></Field>
            <Field label="Account Holder Name"><Input name="accountHolderName" defaultValue={me.kyc?.accountHolderName ?? ""} /></Field>
            <Field label="Account Number"><Input name="accountNumber" /></Field>
            <Field label="IFSC Code"><Input name="ifscCode" defaultValue={me.kyc?.ifscCode ?? ""} /></Field>
          </div>

          <div className="mb-2 mt-4 text-sm font-semibold">Nominee Details</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nominee Name"><Input name="nomineeName" defaultValue={me.kyc?.nomineeName ?? ""} placeholder="Family member name" /></Field>
            <Field label="Relation"><Input name="nomineeRelation" defaultValue={me.kyc?.nomineeRelation ?? ""} placeholder="Father / Mother / Spouse" /></Field>
            <Field label="Nominee Mobile"><Input name="nomineePhone" inputMode="numeric" defaultValue={me.kyc?.nomineePhone ?? ""} placeholder="10-digit" /></Field>
          </div>

          <SubmitButton className="mt-4 w-full sm:w-auto">{canEdit ? "Update & Submit for Review" : "Complete & Submit KYC"}</SubmitButton>
        </StatefulForm>
      </CardContent>
    </Card>
  );
}
