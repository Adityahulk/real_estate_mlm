import { currentMember } from "@/lib/services/queries";
import { submitKycAction } from "@/server/member-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Field, Input, Badge } from "@/components/ui";
import { decryptPII } from "@/lib/crypto";

export default async function KycPage() {
  const me = await currentMember();
  const canEdit = me.kyc?.editAllowed;
  const aadhaarCardNumber = decryptPII(me.kyc?.aadhaarCardNumber);
  const panCardNumber = decryptPII(me.kyc?.panCardNumber);
  const accountNumber = decryptPII(me.kyc?.accountNumber);

  if (me.kycStatus === "APPROVED" && !canEdit) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Badge tone="success">APPROVED</Badge>
          <span className="font-medium">Your KYC is complete. Your income payouts can be released.</span>
        </div>
      </Card>
    );
  }

  if (me.kycStatus === "PENDING" && !canEdit) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Badge tone="warning">PENDING</Badge>
          <span className="font-medium">Your KYC record is pending. Contact admin if you need editing access.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{canEdit ? "Edit KYC" : "Complete KYC"}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">Enter Aadhaar, PAN, bank details, and nominee details. On submit, your KYC will be marked complete.</p>
        {me.kyc?.rejectionReason && (
          <p className="mt-1 text-sm text-danger">Previously rejected: {me.kyc.rejectionReason}</p>
        )}
        {canEdit && <p className="mt-1 text-sm text-brand-foreground">Admin has enabled editing for this KYC record.</p>}
      </CardHeader>
      <CardContent>
        <StatefulForm action={submitKycAction}>
          <div className="mb-2 text-sm font-semibold">Identity Details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Aadhaar Card Number"><Input name="aadhaarCardNumber" inputMode="numeric" maxLength={12} defaultValue={aadhaarCardNumber ?? ""} placeholder="12-digit Aadhaar number" /></Field>
            <Field label="PAN Card Number"><Input name="panCardNumber" defaultValue={panCardNumber ?? ""} placeholder="ABCDE1234F" /></Field>
            <div className="sm:col-span-2">
              <Field label="Aadhaar Card Address">
                <textarea
                  name="aadhaarCardAddress"
                  defaultValue={me.kyc?.aadhaarCardAddress ?? ""}
                  rows={3}
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground"
                  placeholder="Address as per Aadhaar card"
                />
              </Field>
            </div>
            <Field label="Profile Photo (optional)"><Input type="file" name="profilePhoto" accept="image/*" /></Field>
          </div>

        <div className="mb-2 mt-4 text-sm font-semibold">Bank Details (for payouts)</div>
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank Name"><Input name="bankName" defaultValue={me.kyc?.bankName ?? ""} /></Field>
            <Field label="Account Holder Name"><Input name="accountHolderName" defaultValue={me.kyc?.accountHolderName ?? ""} /></Field>
            <Field label="Account Number"><Input name="accountNumber" defaultValue={accountNumber ?? ""} /></Field>
            <Field label="IFSC Code"><Input name="ifscCode" defaultValue={me.kyc?.ifscCode ?? ""} /></Field>
          </div>

          <div className="mb-2 mt-4 text-sm font-semibold">Nominee Details</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nominee Name"><Input name="nomineeName" defaultValue={me.kyc?.nomineeName ?? ""} placeholder="Family member name" /></Field>
            <Field label="Relation"><Input name="nomineeRelation" defaultValue={me.kyc?.nomineeRelation ?? ""} placeholder="Father / Mother / Spouse" /></Field>
            <Field label="Nominee Mobile"><Input name="nomineePhone" inputMode="numeric" defaultValue={me.kyc?.nomineePhone ?? ""} placeholder="10-digit" /></Field>
          </div>

          <SubmitButton className="mt-4 w-full sm:w-auto">{canEdit ? "Update & Complete KYC" : "Complete & Submit KYC"}</SubmitButton>
        </StatefulForm>
      </CardContent>
    </Card>
  );
}
