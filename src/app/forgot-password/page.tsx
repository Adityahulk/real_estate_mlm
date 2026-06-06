import Link from "next/link";
import { requestPasswordResetAction, resetPasswordAction } from "@/server/auth-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
    <Card className="p-6"><h1 className="mb-4 text-xl font-semibold">Request Reset Code</h1><StatefulForm action={requestPasswordResetAction}><Field label="Email"><Input name="email" type="email"/></Field><SubmitButton>Send Code</SubmitButton></StatefulForm></Card>
    <Card className="p-6"><h1 className="mb-4 text-xl font-semibold">Set New Password</h1><StatefulForm action={resetPasswordAction}><Field label="Email"><Input name="email" type="email"/></Field><Field label="Reset Code"><Input name="code"/></Field><Field label="New Password"><Input name="password" type="password"/></Field><SubmitButton>Update Password</SubmitButton></StatefulForm><p className="mt-4 text-sm"><Link href="/login" className="underline">Back to login</Link></p></Card>
  </div></main>;
}
