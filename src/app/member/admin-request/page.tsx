import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { submitAdminRequestAction } from "@/server/member-actions";
import { Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, Select } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/form";

const statusTone = { OPEN: "warning", IN_PROGRESS: "brand", RESOLVED: "success", CLOSED: "neutral" } as const;

export default async function AdminRequestPage() {
  const member = await currentMember();
  const requests = await prisma.supportRequest.findMany({
    where: { memberId: member.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin Request</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Send payment, login, KYC, plot, income, or tree issues to admin.</p>
        </CardHeader>
        <CardContent>
          <StatefulForm action={submitAdminRequestAction}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                <Select name="category" defaultValue="PAYMENT">
                  <option value="PAYMENT">Payment</option>
                  <option value="LOGIN">Login</option>
                  <option value="KYC">KYC</option>
                  <option value="PLOT">Plot</option>
                  <option value="INCOME">Income</option>
                  <option value="TREE">Tree</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Subject">
                <Input name="subject" placeholder="Short title" />
              </Field>
            </div>
            <Field label="Problem Details">
              <textarea
                name="message"
                rows={4}
                className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-ring/20"
                placeholder="Write your issue here"
              />
            </Field>
            <SubmitButton>Send Request to Admin</SubmitButton>
          </StatefulForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My Requests</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {requests.map((request) => (
            <details key={request.id} className="rounded-lg border bg-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <div className="font-semibold">{request.subject}</div>
                  <div className="text-xs text-muted-foreground">{request.category.replace("_", " ")} · {request.createdAt.toISOString().slice(0, 10)}</div>
                </div>
                <Badge tone={statusTone[request.status]}>{request.status.replace("_", " ")}</Badge>
              </summary>
              <div className="space-y-2 border-t p-3 text-sm">
                <div><span className="text-muted-foreground">Your message</span><br />{request.message}</div>
                <div><span className="text-muted-foreground">Admin reply</span><br />{request.adminReply ?? "No reply yet"}</div>
              </div>
            </details>
          ))}
          {!requests.length && <div className="py-4 text-center text-sm text-muted-foreground">No admin requests yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
