import Link from "next/link";
import { registerAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (
    <AuthShell wide eyebrow="Free Member Registration" title="Register Free" description="The system creates your Member ID automatically. Use it as your Sponsor ID and use the same ID to log in.">
        <StatefulForm action={registerAction}>
          <Field label="Full Name">
            <Input name="fullName" placeholder="Full name" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mobile Number">
              <Input name="mobile" inputMode="numeric" placeholder="10-digit" />
            </Field>
            <Field label="Email (optional)">
              <Input name="email" type="email" placeholder="you@email.com" />
            </Field>
          </div>
          <Field label="Password">
            <Input name="password" type="password" placeholder="At least 6 characters" />
          </Field>
          <Field label="Sponsor ID">
            <Input name="sponsorMemberId" defaultValue={ref ?? ""} placeholder="Sponsor member ID or COMPANY" />
          </Field>
          <div className="mt-2 text-sm font-semibold">Nominee Details (optional)</div>
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
