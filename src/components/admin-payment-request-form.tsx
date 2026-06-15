"use client";

import { useEffect, useState } from "react";
import { generatePaymentRequestAction } from "@/server/admin-actions";
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

export function AdminPaymentRequestForm({ members }: { members: PaymentMemberOption[] }) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [paymentType, setPaymentType] = useState<"EMI" | "CASHBACK_FULL">("EMI");
  const [emiScheduleId, setEmiScheduleId] = useState("");

  const member = members.find((row) => row.id === memberId) ?? null;

  useEffect(() => {
    if (!member) return;
    if (member.paymentPlan === "CASHBACK") {
      setPaymentType("CASHBACK_FULL");
      setEmiScheduleId("");
      return;
    }
    setPaymentType("EMI");
    setEmiScheduleId(member.openEmis[0]?.id ?? "");
  }, [member]);

  const hasOpenEmi = !!member?.openEmis.length;
  const amount = paymentType === "CASHBACK_FULL"
    ? member?.cashbackRemaining ?? "0.00"
    : member?.openEmis.find((emi) => emi.id === emiScheduleId)?.amount ?? "0.00";
  const canSubmit = !!member && ((paymentType === "EMI" && hasOpenEmi && !!emiScheduleId) || (paymentType === "CASHBACK_FULL" && amount !== "0.00"));

  return (
    <StatefulForm action={generatePaymentRequestAction}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Member">
          <Select name="memberId" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            {members.map((row) => (
              <option key={row.id} value={row.id}>{row.memberId} · {row.fullName}</option>
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
              <option key={emi.id} value={emi.id}>{emi.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Generated Amount">
          <Input value={amount} readOnly aria-readonly="true" />
        </Field>

        <Field label="Admin Note">
          <Input name="notes" placeholder="Optional note for member" />
        </Field>
      </div>

      <SubmitButton disabled={!canSubmit} pendingText="Generating...">
        Generate Payment Request
      </SubmitButton>
    </StatefulForm>
  );
}
