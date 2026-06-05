"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "./ui";

type ActionState = { error?: string; success?: string } | undefined;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className} size="lg">
      {pending ? "Please wait…" : children}
    </Button>
  );
}

export function StatefulForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && (
        <div className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</div>
      )}
      {state?.success && (
        <div className="mb-3 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{state.success}</div>
      )}
      {children}
    </form>
  );
}
