import QRCode from "qrcode";
import { headers } from "next/headers";
import { currentMember } from "@/lib/services/queries";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { CopyField } from "@/components/copy";

export default async function ReferralPage() {
  const me = await currentMember();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const base = (host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_BASE_URL || "https://shreeshyam.group").replace(/\/$/, "");
  const link = `${base}/register?ref=${me.memberId}`;
  const qr = await QRCode.toDataURL(link, { width: 240, margin: 1 });

  const referrals = await prisma.member.findMany({
    where: { sponsorId: me.id, plotId: { not: null } },
    select: { memberId: true, fullName: true, joinDate: true, kycStatus: true },
    orderBy: { joinDate: "desc" },
  });
  const applications = await prisma.memberApplication.findMany({
    where: { sponsorId: me.id, status: "PENDING" },
    select: { id: true, applicationCode: true, fullName: true, mobile: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Refer & Earn</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Referral QR" className="h-40 w-40 rounded-xl border bg-white p-2" />
          <div className="w-full">
            <p className="text-sm text-muted-foreground">Share this link. Anyone who joins through it becomes your direct referral and earns you Direct Sponsor income.</p>
            <div className="mt-3"><CopyField value={link} /></div>
            <p className="mt-2 text-xs text-muted-foreground">Free members can log in and refer others immediately. They enter your paid referral count and binary tree after admin activates their plot.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Free Registrations Pending Payment ({applications.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {applications.map((application) => (
            <div key={application.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
              <span>{application.mobile} · {application.fullName}</span>
              <span className="text-muted-foreground">{application.createdAt.toISOString().slice(0, 10)}</span>
            </div>
          ))}
          {applications.length === 0 && <div className="py-4 text-center text-muted-foreground">No free registrations pending payment.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Paid Direct Referrals ({referrals.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {referrals.map((r) => (
            <div key={r.memberId} className="flex items-center justify-between border-b py-1.5 last:border-0">
              <span>{r.memberId} · {r.fullName}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {r.joinDate.toISOString().slice(0, 10)}
                <Badge tone={r.kycStatus === "APPROVED" ? "success" : "neutral"}>{r.kycStatus.replace("_", " ")}</Badge>
              </span>
            </div>
          ))}
          {referrals.length === 0 && <div className="py-4 text-center text-muted-foreground">No referrals yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
