import Link from "next/link";
import { loginAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">Member Login</h1>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Welcome back to Shree Shyam Villa – 2</p>
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
          <Link href="/register" className="font-medium text-brand-foreground underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm"><Link href="/forgot-password" className="text-brand-foreground underline">Forgot password?</Link></p>
      </Card>
    </main>
  );
}
