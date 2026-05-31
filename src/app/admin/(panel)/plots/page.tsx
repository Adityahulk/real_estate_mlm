import { prisma } from "@/lib/db";
import { createPlotAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Badge, Field, Input } from "@/components/ui";
import { formatINR } from "@/lib/money";

const plotTone = { AVAILABLE: "success", BOOKED: "warning", SOLD: "brand", DRAW_WON: "brand" } as const;

export default async function PlotsPage() {
  const plots = await prisma.plot.findMany({ orderBy: { plotNumber: "asc" }, include: { member: true } });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add Plot</CardTitle></CardHeader>
        <CardContent>
          <StatefulForm action={createPlotAction}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Plot Number"><Input name="plotNumber" placeholder="P021" /></Field>
              <Field label="Plot Price"><Input name="plotPrice" inputMode="numeric" defaultValue="300000" /></Field>
              <Field label="Development Charges"><Input name="developmentCharges" inputMode="numeric" defaultValue="25000" /></Field>
              <Field label="Documentation Charges"><Input name="documentationCharges" inputMode="numeric" defaultValue="15000" /></Field>
              <Field label="Location Block"><Input name="locationBlock" placeholder="Block A" /></Field>
              <Field label="Row Number"><Input name="rowNumber" placeholder="1" /></Field>
            </div>
            <SubmitButton>Add Plot</SubmitButton>
          </StatefulForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plot Inventory ({plots.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Plot</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Member</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{p.plotNumber}</td>
                  <td className="px-4 py-2">{formatINR(p.plotPrice)}</td>
                  <td className="px-4 py-2">{p.locationBlock ?? "-"} · {p.rowNumber ?? "-"}</td>
                  <td className="px-4 py-2"><Badge tone={plotTone[p.status]}>{p.status}</Badge></td>
                  <td className="px-4 py-2">{p.member?.fullName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
