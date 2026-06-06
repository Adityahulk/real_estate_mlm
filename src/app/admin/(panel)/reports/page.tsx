import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";

export default async function ReportsPage() {
  const [payments, payouts, commissions, members, overdue, transfers] = await Promise.all([
    prisma.payment.groupBy({ by:["paymentMode"], where:{status:"VERIFIED"}, _sum:{amount:true}, _count:true }),
    prisma.payout.groupBy({ by:["status"], _sum:{netAmount:true}, _count:true }),
    prisma.commissionLedger.aggregate({_sum:{cashAmount:true},_count:true}),
    prisma.member.count({where:{isActive:true,NOT:{memberId:"COMPANY"}}}),
    prisma.emiSchedule.count({where:{status:"OVERDUE"}}),
    prisma.plotTransfer.count(),
  ]);
  const collected=payments.reduce((sum,row)=>sum+(row._sum.amount?.toNumber()??0),0);
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-4"><Stat label="Active Members" value={members}/><Stat label="Collected" value={formatINR(collected)}/><Stat label="Commission Lines" value={commissions._count}/><Stat label="Overdue EMIs" value={overdue}/></div>
  <Card><CardHeader><CardTitle>Payments by Mode</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{payments.map(r=><div key={r.paymentMode} className="flex justify-between border-b py-2"><span>{r.paymentMode} · {r._count} payments</span><b>{formatINR(r._sum.amount??0)}</b></div>)}</CardContent></Card>
  <Card><CardHeader><CardTitle>Payouts by Status</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{payouts.map(r=><div key={r.status} className="flex justify-between border-b py-2"><span>{r.status} · {r._count}</span><b>{formatINR(r._sum.netAmount??0)}</b></div>)}<div className="pt-2 text-muted-foreground">Recorded plot transfers: {transfers}</div></CardContent></Card></div>;
}
