import { prisma } from "@/lib/db";
import { approveInsuranceClaimAction, rejectInsuranceClaimAction, runDailyOperationsAction, transferPlotAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Stat } from "@/components/ui";

export default async function OperationsPage() {
  const [members, claims, overdue, pendingCashbacks] = await Promise.all([
    prisma.member.findMany({ where: { isActive: true, NOT: { memberId: "COMPANY" } }, orderBy: { memberId: "asc" } }),
    prisma.insuranceClaim.findMany({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } }, include: { member: true }, orderBy: { claimSubmittedAt: "asc" } }),
    prisma.emiSchedule.count({ where: { status: "OVERDUE" } }),
    prisma.cashbackCredit.count({ where: { status: "PENDING" } }),
  ]);
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Overdue EMIs" value={overdue}/><Stat label="Pending Cashbacks" value={pendingCashbacks}/><Stat label="Insurance Reviews" value={claims.length}/></div>
    <Card><CardHeader><CardTitle>Daily Operations</CardTitle></CardHeader><CardContent><form action={runDailyOperationsAction}><Button type="submit">Run EMI Status, Reminders & Cashbacks</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle>Transfer Plot / Member ID</CardTitle></CardHeader><CardContent><StatefulForm action={transferPlotAction}><div className="grid gap-3 sm:grid-cols-3">
      <Field label="Member ID"><Select name="memberId">{members.map(m=><option key={m.id} value={m.id}>{m.memberId} · {m.fullName}</option>)}</Select></Field>
      <Field label="New Full Name"><Input name="newFullName"/></Field><Field label="New Mobile"><Input name="newMobile"/></Field>
      <Field label="New Email"><Input name="newEmail" type="email"/></Field><Field label="Temporary Password"><Input name="newPassword" type="password"/></Field>
    </div><SubmitButton>Record Transfer</SubmitButton></StatefulForm></CardContent></Card>
    <Card><CardHeader><CardTitle>Insurance Claims</CardTitle></CardHeader><CardContent className="space-y-3">{claims.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"><div><b>{c.member.memberId} · {c.member.fullName}</b><div className="text-sm text-muted-foreground">{c.deathType} · {c.monthsPaid} months paid · nominee {c.nomineeName}</div></div><div className="flex gap-2"><form action={approveInsuranceClaimAction.bind(null,c.id)}><Button type="submit" size="sm" variant="success">Approve</Button></form><form action={rejectInsuranceClaimAction.bind(null,c.id)}><Button type="submit" size="sm" variant="danger">Reject</Button></form></div></div>)}{!claims.length&&<div className="text-sm text-muted-foreground">No pending claims.</div>}</CardContent></Card>
  </div>;
}
