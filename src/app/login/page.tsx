import Link from "next/link";
import { loginAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Member & Admin Portal" title="Welcome Back" description="Members can log in with their generated Member ID, mobile number, or email. Admins can log in with email.">
        <StatefulForm action={loginAction}>
          <Field label="Member ID, Mobile Number, or Email">
            <Input name="loginId" autoComplete="username" placeholder="SSV000001, mobile number, or email" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" placeholder="Your password" />
          </Field>
          <SubmitButton className="mt-2 w-full">Login</SubmitButton>
        </StatefulForm>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-brand underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">Forgot your password? Contact admin to set a new password.</p>
    </AuthShell>
  );
}
