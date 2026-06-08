import { currentMember } from "@/lib/services/queries";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { PROJECT } from "@/lib/project";

export default async function MyPlotPage() {
  const me = await currentMember();
  const p = me.plot;
  if (!p) return <Card className="p-6">No plot assigned yet.</Card>;

  const docs = [
    { label: "7/12 (Satbara)", url: p.satbaraDocUrl },
    { label: "Mapping", url: p.mappingDocUrl },
    { label: "Entry", url: p.entryDocUrl },
    { label: "Legal", url: p.legalDocUrl },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Plot {p.plotNumber}</CardTitle></CardHeader>
        <CardContent className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <Row k="Size" v={p.plotSize} />
          <Row k="Area" v={`${PROJECT.plotAreaSqFt} sq.ft.`} />
          <Row k="Rate" v={`₹${PROJECT.ratePerSqFt} per sq.ft.`} />
          <Row k="Status" v={<Badge tone="brand">{p.status}</Badge>} />
          <Row k="Plot Price" v={formatINR(p.plotPrice)} />
          <Row k="Development Charges" v={formatINR(p.developmentCharges)} />
          <Row k="Documentation Charges" v={formatINR(p.documentationCharges)} />
          <Row k="Location" v={`${p.locationBlock ?? "-"} · Row ${p.rowNumber ?? "-"}`} />
          <Row k="Road Facing" v={p.roadFacing ? "Yes (40 ft road)" : "No"} />
          <Row k="Booking Date" v={p.bookingDate ? p.bookingDate.toISOString().slice(0, 10) : "Not booked yet"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
        <CardContent className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <Row k="Survey No." v={PROJECT.surveyNo} />
          <Row k="Block No." v={PROJECT.blockNo} />
          <Row k="Village" v={PROJECT.village} />
          <Row k="Taluka" v={PROJECT.taluka} />
          <Row k="District" v={PROJECT.district} />
          <Row k="Road" v={PROJECT.road} />
          <Row k="Legal Status" v={<Badge tone="success">{PROJECT.legalStatus}</Badge>} />
          <Row k="Project" v={PROJECT.siteName} />
          <Row k="Group" v={PROJECT.groupName} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Legal Documents</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {docs.map((d) => (
            <div key={d.label} className="flex items-center justify-between border-b py-1.5 last:border-0">
              <span className="text-muted-foreground">{d.label}</span>
              {d.url ? (
                <a href={d.url} className="font-medium text-brand-foreground underline" target="_blank">View</a>
              ) : (
                <span className="text-muted-foreground">Pending upload</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
