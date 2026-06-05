import { prisma } from "@/lib/db";
import { bulkCreatePlotsAction, createPlotAction, updatePlotAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Badge, Field, Input, Select } from "@/components/ui";
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
        <CardHeader><CardTitle>Bulk Upload Plots</CardTitle></CardHeader>
        <CardContent>
          <StatefulForm action={bulkCreatePlotsAction}>
            <Field label="Plot Numbers">
              <Input name="plotNumbers" placeholder="P021 P022 P023 or comma separated" />
            </Field>
            <p className="mb-3 text-xs text-muted-foreground">
              Only plot numbers are required. Other plot details can be edited later from the inventory.
            </p>
            <SubmitButton>Add Plots</SubmitButton>
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
                <th className="px-4 py-2">Edit</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((p) => (
                <tr key={p.id} className="border-b align-top last:border-0">
                  <td className="px-4 py-2 font-medium">
                    <form id={`plot-${p.id}`} action={updatePlotAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <Input name="plotNumber" defaultValue={p.plotNumber} className="w-24" />
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <div className="space-y-2">
                      <Input form={`plot-${p.id}`} name="plotPrice" defaultValue={p.plotPrice.toString()} inputMode="numeric" className="w-28" />
                      <div className="flex gap-2">
                        <Input form={`plot-${p.id}`} name="developmentCharges" defaultValue={p.developmentCharges.toString()} inputMode="numeric" placeholder="Dev" className="w-24" />
                        <Input form={`plot-${p.id}`} name="documentationCharges" defaultValue={p.documentationCharges.toString()} inputMode="numeric" placeholder="Doc" className="w-24" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Input form={`plot-${p.id}`} name="locationBlock" defaultValue={p.locationBlock ?? ""} placeholder="Block" className="w-28" />
                      <Input form={`plot-${p.id}`} name="rowNumber" defaultValue={p.rowNumber ?? ""} placeholder="Row" className="w-20" />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatINR(p.plotPrice)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <Select form={`plot-${p.id}`} name="status" defaultValue={p.status} className="w-32">
                      <option value="AVAILABLE">Available</option>
                      <option value="BOOKED">Booked</option>
                      <option value="SOLD">Sold</option>
                      <option value="DRAW_WON">Draw Won</option>
                    </Select>
                    <div className="mt-1"><Badge tone={plotTone[p.status]}>{p.status}</Badge></div>
                  </td>
                  <td className="px-4 py-2">{p.member?.fullName ?? "—"}</td>
                  <td className="px-4 py-2">
                    <button form={`plot-${p.id}`} type="submit" className="rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-foreground">
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
