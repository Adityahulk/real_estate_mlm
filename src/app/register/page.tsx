import Link from "next/link";
import { registerAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, Field, Input, Select } from "@/components/ui";

export default function RegisterPage({ searchParams }: { searchParams: { ref?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">Join Shree Shyam Villa – 2</h1>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          A plot will be assigned to you. Your plot number becomes your Member ID.
        </p>
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
            <Field label="Sponsor ID (optional)">
              <Input name="sponsorMemberId" defaultValue={searchParams.ref ?? ""} placeholder="e.g. P001" />
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
          <Link href="/login" className="font-medium text-brand-foreground underline">
            Login
          </Link>
        </p>
      </Card>
    </main>
  );
}
