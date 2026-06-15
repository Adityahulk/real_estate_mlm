"use client";

import { useEffect, useState } from "react";
import { recordOfflinePaymentAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";

type PaymentMemberOption = {
  id: string;
  memberId: string;
  fullName: string;
  paymentPlan: "INSTALLMENT" | "CASHBACK";
  cashbackRemaining: string;
  openEmis: Array<{
    id: string;
    installmentNo: number;
    amount: string;
    label: string;
  }>;
};

export function AdminPaymentEntryForm({ members }: { members: PaymentMemberOption[] }) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [paymentType, setPaymentType] = useState<"EMI" | "CASHBACK_FULL">("EMI");
  const [emiScheduleId, setEmiScheduleId] = useState("");
  const [amount, setAmount] = useState("");

  const member = members.find((row) => row.id === memberId) ?? null;

  useEffect(() => {
    if (!member) return;
    if (member.paymentPlan === "CASHBACK") {
      setPaymentType("CASHBACK_FULL");
      setEmiScheduleId("");
      setAmount(member.cashbackRemaining);
      return;
    }
    setPaymentType("EMI");
    const nextEmiId = member.openEmis[0]?.id ?? "";
    setEmiScheduleId(nextEmiId);
    setAmount(member.openEmis[0]?.amount ?? "");
  }, [member]);

  useEffect(() => {
    if (!member || paymentType !== "EMI") return;
    const emi = member.openEmis.find((row) => row.id === emiScheduleId) ?? member.openEmis[0];
    setAmount(emi?.amount ?? "");
  }, [emiScheduleId, member, paymentType]);

  const dateDefault = new Date().toISOString().slice(0, 10);
  const hasOpenEmi = !!member?.openEmis.length;
  const canSubmit = !!member && ((paymentType === "EMI" && hasOpenEmi && !!emiScheduleId && !!amount) || (paymentType === "CASHBACK_FULL" && !!amount && amount !== "0.00"));

  return (
    <StatefulForm action={recordOfflinePaymentAction}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Member">
          <Select name="memberId" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            {members.map((row) => (
              <option key={row.id} value={row.id}>
                {row.memberId} · {row.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Payment Type">
          <Select
            name="paymentType"
            value={paymentType}
            onChange={(event) => setPaymentType(event.target.value as "EMI" | "CASHBACK_FULL")}
            disabled={!member || member.paymentPlan !== "CASHBACK"}
          >
            <option value="EMI">EMI installment</option>
            <option value="CASHBACK_FULL">Cashback plan full payment</option>
          </Select>
        </Field>

        <Field label="EMI Installment">
          <Select
            name="emiScheduleId"
            value={emiScheduleId}
            onChange={(event) => setEmiScheduleId(event.target.value)}
            disabled={paymentType !== "EMI" || !hasOpenEmi}
          >
            <option value="">{hasOpenEmi ? "Select EMI installment" : "No open EMI"}</option>
            {member?.openEmis.map((emi) => (
              <option key={emi.id} value={emi.id}>
                {emi.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Amount (₹)">
          <Input name="amount" value={amount} readOnly aria-readonly="true" />
        </Field>

        <Field label="Payment Mode">
          <Select name="paymentMode" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="OFFLINE">Other Offline</option>
          </Select>
        </Field>

        <Field label="Reference Number">
          <Input name="referenceNumber" placeholder="Optional UTR / receipt" />
        </Field>

        <Field label="Payment Date">
          <Input name="paymentDate" type="date" defaultValue={dateDefault} />
        </Field>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {paymentType === "EMI"
          ? "The form automatically picks the member's next unpaid installment and fills the exact amount."
          : "For cashback members, the form fills the remaining full-payment amount automatically."}
      </p>

      <SubmitButton disabled={!canSubmit}>
        Verify &amp; Record
      </SubmitButton>
    </StatefulForm>
  );
}
