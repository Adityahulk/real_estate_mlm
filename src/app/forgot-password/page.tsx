"use client";

import Link from "next/link";
import { useFormStatus, useFormState as useActionState } from "react-dom";
import { useState } from "react";
import { requestPasswordResetAction, resetPasswordAction } from "@/server/auth-actions";
import { SubmitButton } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  const [resetEmail, setResetEmail] = useState("");

  const [reqState, reqAction] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await requestPasswordResetAction(undefined, formData);
      if (result?.success) setResetEmail(String(formData.get("email") ?? "").toLowerCase().trim());
      return result;
    },
    undefined
  );

  const [resetState, resetAction] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      return await resetPasswordAction(undefined, formData);
    },
    undefined
  );

  const resetDone = resetState?.success && !resetState.error;

  return (
    <AuthShell
      wide
      eyebrow="Account Recovery"
      title="Reset Password"
      description="Enter your registered email to receive a one-time password reset code."
    >
      <div className="grid gap-5 sm:grid-cols-2">

        {/* ── Request OTP ─────────────────────────────── */}
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">1. Get Reset OTP</h2>
          <form action={reqAction} className="flex flex-col gap-3">
            <Field label="Registered Email">
              <Input name="email" type="email" autoComplete="email" placeholder="you@email.com" required />
            </Field>
            <SendOtpButton />
            {reqState?.error && <p className="text-sm text-danger">{reqState.error}</p>}
            {reqState?.success && <p className="text-sm text-success">{reqState.success}</p>}
          </form>
        </Card>

        {/* ── Verify OTP & set new password ───────────── */}
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">2. Set New Password</h2>

          {resetDone ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
                {resetState?.success}
              </div>
              <Link href="/login" className="text-sm font-medium text-brand underline">
                Go to Login →
              </Link>
            </div>
          ) : (
            <form action={resetAction} className="flex flex-col gap-3">
              <Field label="Registered Email">
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  defaultValue={resetEmail}
                  required
                />
              </Field>
              <Field label="OTP from Email">
                <Input name="code" inputMode="numeric" maxLength={6} placeholder="6-digit code" required />
              </Field>
              <Field label="New Password">
                <Input name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" required />
              </Field>
              <SubmitButton>Update Password</SubmitButton>
              {resetState?.error && <p className="text-sm text-danger">{resetState.error}</p>}
            </form>
          )}

          <p className="mt-4 text-sm">
            <Link href="/login" className="text-muted-foreground underline">
              ← Back to login
            </Link>
          </p>
        </Card>
      </div>
    </AuthShell>
  );
}

function SendOtpButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:brightness-105 disabled:opacity-50"
    >
      {pending ? "Sending..." : "Send OTP"}
    </button>
  );
}
