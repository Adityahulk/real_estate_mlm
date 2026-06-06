import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function NotificationsPage() {
  const member = await currentMember();
  const notifications = await prisma.notification.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return <Card><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
    {notifications.map((n) => <div key={n.id} className="border-b py-2 last:border-0"><div className="flex justify-between gap-2"><b>{n.title}</b><Badge tone={n.status === "SENT" ? "success" : "neutral"}>{n.channel}</Badge></div><p className="text-muted-foreground">{n.message}</p><div className="text-xs text-muted-foreground">{n.createdAt.toISOString().slice(0, 10)}</div></div>)}
    {!notifications.length && <div className="text-muted-foreground">No notifications yet.</div>}
  </CardContent></Card>;
}
