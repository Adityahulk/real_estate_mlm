import Link from "next/link";
import { registerAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function RegisterPage({ searchParams }: { searchParams: { ref?: string } }) {
  return (
    <AuthShell wide eyebrow="Free Member Application" title="Register Free" description="Create a free application first. Your ID appears in the structure only after admin collects the token amount and assigns your chosen plot.">
        <StatefulForm action={registerAction}>
          <Field label="Full Name (as per Aadhaar)">
            <Input name="fullName" placeholder="Full name" />
          </Field>
          <Field label="Aadhaar Number">
            <Input name="aadhaarNumber" inputMode="numeric" placeholder="12-digit Aadhaar" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mobile (WhatsApp)">
              <Input name="mobile" inputMode="numeric" placeholder="10-digit" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="you@email.com" />
            </Field>
          </div>
          <Field label="Password">
            <Input name="password" type="password" placeholder="At least 6 characters" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referred By Plot Number (optional)">
              <Input name="sponsorMemberId" defaultValue={searchParams.ref ?? ""} placeholder="Blank if not referred" />
            </Field>
            <Field label="Payment Plan">
              <Select name="paymentPlan" defaultValue="INSTALLMENT">
                <option value="INSTALLMENT">Installment</option>
                <option value="CASHBACK">Cashback</option>
              </Select>
            </Field>
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
