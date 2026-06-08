import Link from "next/link";
import { loginAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Member Portal" title="Welcome Back" description="Access your plot, payments, income, team, and rewards.">
        <StatefulForm action={loginAction}>
          <Field label="Mobile Number">
            <Input name="mobile" inputMode="numeric" placeholder="10-digit mobile" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" placeholder="Your password" />
          </Field>
          <SubmitButton className="mt-2 w-full">Login</SubmitButton>
        </StatefulForm>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-brand underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm"><Link href="/forgot-password" className="text-brand underline">Forgot password?</Link></p>
    </AuthShell>
  );
}
