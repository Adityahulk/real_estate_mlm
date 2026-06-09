import Link from "next/link";
import { registerAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (
    <AuthShell wide eyebrow="Free Member Application" title="Register Free" description="Register without payment or KYC. Your ID enters the binary structure only after admin approval.">
        <StatefulForm action={registerAction}>
          <Field label="Full Name">
            <Input name="fullName" placeholder="Full name" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mobile Number">
              <Input name="mobile" inputMode="numeric" placeholder="10-digit" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="you@email.com" />
            </Field>
          </div>
          <Field label="Password">
            <Input name="password" type="password" placeholder="At least 6 characters" />
          </Field>
          <Field label="Sponsor ID (optional)">
            <Input name="sponsorMemberId" defaultValue={ref ?? ""} placeholder="Paid member ID or FREE- ID" />
          </Field>
          <div className="mt-2 text-sm font-semibold">Nominee Details</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nominee Name"><Input name="nomineeName" /></Field>
            <Field label="Relation"><Input name="nomineeRelation" /></Field>
            <Field label="Nominee Mobile"><Input name="nomineePhone" inputMode="numeric" placeholder="10-digit" /></Field>
          </div>
          <SubmitButton className="mt-2 w-full">Create Account</SubmitButton>
        </StatefulForm>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already a member?{" "}
          <Link href="/login" className="font-medium text-brand underline">
            Login
          </Link>
        </p>
    </AuthShell>
  );
}
