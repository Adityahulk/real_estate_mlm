import { adminLoginAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function AdminLoginPage() {
  return (
    <AuthShell eyebrow="Administration" title="Control Panel" description="Manage members, plots, payments, payouts, draws, and operations.">
        <StatefulForm action={adminLoginAction}>
          <Field label="Email">
            <Input name="email" type="email" placeholder="admin@ssv.local" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" />
          </Field>
          <SubmitButton className="mt-2 w-full">Login</SubmitButton>
        </StatefulForm>
    </AuthShell>
  );
}
