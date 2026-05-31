import { adminLoginAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">Admin Login</h1>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Shree Shyam Villa – 2 control panel</p>
        <StatefulForm action={adminLoginAction}>
          <Field label="Email">
            <Input name="email" type="email" placeholder="admin@ssv.local" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" />
          </Field>
          <SubmitButton className="mt-2 w-full">Login</SubmitButton>
        </StatefulForm>
      </Card>
    </main>
  );
}
