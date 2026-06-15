import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { bulkCreatePlotsAction, createPlotAction, reassignMemberPlotAction, updatePlotAction, updatePlotDocumentsAction } from "@/server/admin-actions";
import { StatefulForm, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle, Badge, Field, Input, Select } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { FIXED_PLOT_PRICE } from "@/lib/business-rules";

const plotTone = { AVAILABLE: "success", BOOKED: "warning", SOLD: "brand", DRAW_WON: "brand" } as const;

export default async function PlotsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim() ?? "";
  const [plots, totalPlots, assignedMembers, availablePlots] = await Promise.all([
    prisma.plot.findMany({
      where: query ? { plotNumber: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: { plotNumber: "asc" },
      include: { member: true },
    }),
    prisma.plot.count(),
    prisma.member.findMany({
      where: { plotId: { not: null }, NOT: { memberId: "COMPANY" } },
      select: { id: true, memberId: true, fullName: true, plot: { select: { plotNumber: true } } },
      orderBy: { memberId: "asc" },
    }),
    prisma.plot.findMany({
      where: { status: "AVAILABLE" },
      select: { plotNumber: true },
      orderBy: { plotNumber: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add Plot</CardTitle></CardHeader>
        <CardContent>
          <StatefulForm action={createPlotAction}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Plot Number"><Input name="plotNumber" placeholder="P021" /></Field>
              <Field label="Location Block"><Input name="locationBlock" placeholder="Block A" /></Field>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Every plot has a fixed price of {formatINR(FIXED_PLOT_PRICE)}.</p>
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
        <CardHeader>
          <CardTitle>Change Member Plot Number</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Use this when admin needs to move an approved member from one allotted plot number to another available plot number.</p>
        </CardHeader>
        <CardContent>
          <StatefulForm action={reassignMemberPlotAction}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Member">
                <Select name="memberId">
                  {assignedMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.memberId} · {member.fullName} · Current {member.plot?.plotNumber ?? "—"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="New Plot Number">
                <Input name="newPlotNumber" list="available-plot-options" placeholder="P011" />
              </Field>
            </div>
            <SubmitButton>Change Plot Number</SubmitButton>
          </StatefulForm>
          <datalist id="available-plot-options">
            {availablePlots.map((plot) => <option key={plot.plotNumber} value={plot.plotNumber} />)}
          </datalist>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plot Inventory ({query ? `${plots.length} of ${totalPlots}` : totalPlots})</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Search by plot number, then expand a plot to edit its details.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action="/admin/plots" className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={query} placeholder="Search plot number, for example P001" className="pl-9" />
            </div>
            <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">Search</button>
            {query && <Link href="/admin/plots" className="rounded-xl border px-4 py-2 text-center text-sm font-medium">Clear</Link>}
          </form>

          {plots.map((p) => (
            <details key={p.id} className="group min-w-0 rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{p.plotNumber}</h4>
                    <Badge tone={plotTone[p.status]}>{p.status}</Badge>
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {p.member ? `Assigned to ${p.member.fullName}` : "Not assigned to a member"} · {formatINR(p.plotPrice)}
                  </p>
                </div>
                <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>

              <div className="border-t p-4">
                <form action={updatePlotAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Plot Number"><Input name="plotNumber" defaultValue={p.plotNumber} /></Field>
                    <Field label="Fixed Plot Price"><Input value={FIXED_PLOT_PRICE} readOnly aria-readonly="true" /></Field>
                    <Field label="Status">
                      <Select name="status" defaultValue={p.status}>
                        <option value="AVAILABLE">Available</option>
                        <option value="BOOKED">Booked</option>
                        <option value="SOLD">Sold</option>
                        <option value="DRAW_WON">Draw Won</option>
                      </Select>
                    </Field>
                    <Field label="Location Block"><Input name="locationBlock" defaultValue={p.locationBlock ?? ""} placeholder="Block" /></Field>
                  </div>
                  <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
                    Save Plot Details
                  </button>
                </form>

                <form action={updatePlotDocumentsAction} className="mt-4 border-t pt-4">
                  <input type="hidden" name="plotId" value={p.id} />
                  <div className="mb-3 text-sm font-medium">Plot Documents</div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <Field label="7/12 Satbara"><Input type="file" name="satbara" accept="image/*,.pdf" className="min-w-0 px-2 text-xs" /></Field>
                    <Field label="Mapping"><Input type="file" name="mapping" accept="image/*,.pdf" className="min-w-0 px-2 text-xs" /></Field>
                    <Field label="Entry"><Input type="file" name="entry" accept="image/*,.pdf" className="min-w-0 px-2 text-xs" /></Field>
                    <Field label="Legal"><Input type="file" name="legal" accept="image/*,.pdf" className="min-w-0 px-2 text-xs" /></Field>
                  </div>
                  <button type="submit" className="rounded-xl border px-4 py-2 text-sm font-medium">Upload Documents</button>
                </form>
              </div>
            </details>
          ))}
          {!plots.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No plot number matches “{query}”.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
