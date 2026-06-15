import { prisma } from "@/lib/db";
import { updateSupportRequestAction } from "@/server/admin-actions";
import { Badge, Card, CardContent, CardHeader, CardTitle, Field, Select } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/form";

const statusTone = { OPEN: "warning", IN_PROGRESS: "brand", RESOLVED: "success", CLOSED: "neutral" } as const;

export default async function AdminRequestsPage() {
  const requests = await prisma.supportRequest.findMany({
    include: { member: { select: { memberId: true, fullName: true, mobile: true } }, handledBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const openCount = requests.filter((request) => request.status === "OPEN" || request.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin Requests ({openCount} open)</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Open a request, reply to the member, and update its status.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {requests.map((request) => (
            <details key={request.id} className="rounded-lg border bg-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <div className="font-semibold">{request.member.memberId} · {request.member.fullName}</div>
                  <div className="text-xs text-muted-foreground">{request.category.replace("_", " ")} · {request.subject} · {request.createdAt.toISOString().slice(0, 10)}</div>
                </div>
                <Badge tone={statusTone[request.status]}>{request.status.replace("_", " ")}</Badge>
              </summary>
              <div className="space-y-3 border-t p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div><span className="text-muted-foreground">Mobile</span><br /><b>{request.member.mobile}</b></div>
                  <div><span className="text-muted-foreground">Handled by</span><br /><b>{request.handledBy?.name ?? "-"}</b></div>
                  <div><span className="text-muted-foreground">Handled date</span><br /><b>{request.handledAt?.toISOString().slice(0, 10) ?? "-"}</b></div>
                </div>
                <div><span className="text-muted-foreground">Member message</span><br />{request.message}</div>
                <StatefulForm action={updateSupportRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                    <Field label="Status">
                      <Select name="status" defaultValue={request.status}>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </Select>
                    </Field>
                    <Field label="Admin Reply">
                      <textarea
                        name="adminReply"
                        defaultValue={request.adminReply ?? ""}
                        rows={2}
                        className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-ring/20"
                        placeholder="Write reply for member"
                      />
                    </Field>
                    <div className="flex items-end pb-3">
                      <SubmitButton className="w-full" pendingText="Updating...">Update</SubmitButton>
                    </div>
                  </div>
                </StatefulForm>
              </div>
            </details>
          ))}
          {!requests.length && <div className="py-4 text-center text-sm text-muted-foreground">No member requests yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
