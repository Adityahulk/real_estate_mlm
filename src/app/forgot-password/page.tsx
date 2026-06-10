import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Password Assistance" title="Contact Admin" description="Admin can securely set a new password for your member ID.">
      <p className="text-sm text-muted-foreground">
        Share your auto-generated Member ID or mobile number with admin. After admin sets the new password, you can log in using the same mobile number.
      </p>
      <Link href="/login" className="mt-4 block"><Button className="w-full">Back to Login</Button></Link>
    </AuthShell>
  );
}
