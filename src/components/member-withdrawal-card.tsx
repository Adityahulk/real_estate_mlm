import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requestWithdrawalAction } from "@/server/member-actions";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/form";

export async function MemberWithdrawalCard({ memberId }: { memberId: string }) {
  const now = new Date();
  const [duePayouts, processingPayouts] = await Promise.all([
    prisma.payout.findMany({
      where: { memberId, status: "PENDING", payoutDate: { lte: now } },
      select: { id: true, netAmount: true, paidAmount: true },
    }),
    prisma.payout.findMany({
      where: { memberId, status: "PROCESSING" },
      select: { id: true, netAmount: true, paidAmount: true },
    }),
  ]);

  const withdrawableAmount = duePayouts.reduce((sum, payout) => sum + Math.max(0, payout.netAmount.toNumber() - payout.paidAmount.toNumber()), 0);
  const requestedAmount = processingPayouts.reduce((sum, payout) => sum + Math.max(0, payout.netAmount.toNumber() - payout.paidAmount.toNumber()), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">Minimum withdrawal is ₹500. Admin will review and mark the payment after transfer.</p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Stat label="Available to Withdraw" value={formatINR(withdrawableAmount)} sub={`${duePayouts.length} due payout line(s)`} />
          <Stat label="Already Requested" value={formatINR(requestedAmount)} sub={`${processingPayouts.length} processing payout line(s)`} />
        </div>
        <StatefulForm action={requestWithdrawalAction} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {withdrawableAmount >= 500
              ? "Only due payouts are included in the request. Held payouts still need approved KYC first."
              : withdrawableAmount > 0
                ? `Available amount is ${formatINR(withdrawableAmount)}. Reach ₹500 to request withdrawal.`
                : "No due payout is available right now. New income becomes withdrawable on its payout date."}
          </div>
          <SubmitButton className="w-full sm:w-auto" disabled={withdrawableAmount < 500} pendingText="Sending request...">
            Request Withdrawal
          </SubmitButton>
        </StatefulForm>
      </CardContent>
    </Card>
  );
}
