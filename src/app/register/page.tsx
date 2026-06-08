"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { registerAction, sendEmailVerificationAction } from "@/server/auth-actions";
import { SubmitButton } from "@/components/form";
import { Field, Input, Select, Card } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

function SendOtpButton({ sent }: { sent: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mb-0.5 inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:brightness-105 disabled:opacity-60"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Sending…
        </span>
      ) : sent ? "Resend OTP" : "Send OTP"}
    </button>
  );
}

export default function RegisterPage({ searchParams }: { searchParams: { ref?: string } }) {
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");

  const [otpState, otpAction] = useFormState(
    async (_prev: unknown, formData: FormData) => {
      const result = await sendEmailVerificationAction(undefined, formData);
      if (result?.success) setOtpSentTo(String(formData.get("email") ?? "").toLowerCase().trim());
      return result;
    },
    undefined
  );

  const [regState, regAction] = useFormState(
    async (_prev: unknown, formData: FormData) => {
      return await registerAction(undefined, formData);
    },
    undefined
  );

  const registrationSuccess = regState?.success && !regState.error;

  return (
    <AuthShell
      wide
      eyebrow="Free Member Application"
      title="Register Free"
      description="Verify your email first, then complete your application."
    >
      <div className="grid gap-5">

        {/* ── Step 1: Email + OTP ─────────────────────── */}
        <Card className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step 1 — Verify your email
          </p>

          <form action={otpAction} className="flex flex-col gap-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Field label="Email address">
                  <Input
                    name="email"
                    type="email"
                    placeholder="you@email.com"
                    defaultValue={otpSentTo ?? ""}
                    readOnly={!!otpSentTo}
                    className={otpSentTo ? "bg-muted cursor-not-allowed" : ""}
                    required
                  />
                </Field>
              </div>
              <SendOtpButton sent={!!otpSentTo} />
            </div>

            {otpState?.error && <p className="text-sm text-destructive">{otpState.error}</p>}
            {otpState?.success && <p className="text-sm text-green-700">{otpState.success}</p>}
          </form>

          {otpSentTo && (
            <div className="mt-3">
              <Field label="6-digit OTP from email">
                <Input
                  name="emailOtp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="______"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </Field>
            </div>
          )}
        </Card>

        {/* ── Step 2: Full registration form ─────────── */}
        {otpSentTo && !registrationSuccess && (
          <Card className="p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 2 — Complete your application
            </p>
            <form action={regAction} className="flex flex-col gap-3">
              <input type="hidden" name="email" value={otpSentTo} />
              <input type="hidden" name="emailOtp" value={otpValue} />

              <Field label="Full Name (as per Aadhaar)">
                <Input name="fullName" placeholder="Full name" required />
              </Field>
              <Field label="Aadhaar Number">
                <Input name="aadhaarNumber" inputMode="numeric" placeholder="12-digit Aadhaar" required />
              </Field>
              <Field label="Mobile (WhatsApp)">
                <Input name="mobile" inputMode="numeric" placeholder="10-digit mobile number" required />
              </Field>
              <Field label="Password">
                <Input name="password" type="password" placeholder="At least 6 characters" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Referred By (Plot No., optional)">
                  <Input name="sponsorMemberId" defaultValue={searchParams.ref ?? ""} placeholder="Leave blank if none" />
                </Field>
                <Field label="Payment Plan">
                  <Select name="paymentPlan" defaultValue="INSTALLMENT">
                    <option value="INSTALLMENT">Installment</option>
                    <option value="CASHBACK">Cashback</option>
                  </Select>
                </Field>
              </div>

              {regState?.error && <p className="text-sm text-destructive">{regState.error}</p>}

              <SubmitButton className="mt-2 w-full">Submit Application</SubmitButton>
            </form>
          </Card>
        )}

        {/* ── Success state ───────────────────────────── */}
        {registrationSuccess && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-sm text-green-800">
            <p className="font-semibold mb-1">Application submitted!</p>
            <p>{regState?.success}</p>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already a member?{" "}
          <Link href="/login" className="font-medium text-brand underline">
            Login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
