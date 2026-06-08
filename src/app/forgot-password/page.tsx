import Link from "next/link";
import { requestPasswordResetAction, resetPasswordAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  return <AuthShell wide eyebrow="Account Recovery" title="Reset Password" description="Password reset is done by registered email only. Verify the email OTP, then log in with your mobile number or email."><div className="grid gap-4 sm:grid-cols-2">
    <Card className="p-6"><h1 className="mb-4 text-xl font-semibold">Request Email OTP</h1><StatefulForm action={requestPasswordResetAction}><Field label="Registered Email"><Input name="email" type="email" autoComplete="email" placeholder="you@email.com"/></Field><SubmitButton>Send OTP</SubmitButton></StatefulForm></Card>
    <Card className="p-6"><h1 className="mb-4 text-xl font-semibold">Verify OTP & Set Password</h1><StatefulForm action={resetPasswordAction}><Field label="Registered Email"><Input name="email" type="email" autoComplete="email" placeholder="you@email.com"/></Field><Field label="Email OTP"><Input name="code" inputMode="numeric" placeholder="6-digit OTP"/></Field><Field label="New Password"><Input name="password" type="password" autoComplete="new-password"/></Field><SubmitButton>Verify OTP & Update Password</SubmitButton></StatefulForm><p className="mt-4 text-sm"><Link href="/login" className="underline">Back to login</Link></p></Card>
  </div></AuthShell>;
}
