import { Card, CardContent, CardHeader, CardTitle, Badge, Stat } from "@/components/ui";
import { PageHeading } from "@/components/brand";
import { DEFAULT_COMMISSION_RULES } from "@/lib/engines/commissionRules";
import { PAIR_REWARD_LABELS } from "@/lib/engines/eligibility";
import { getAllSettings } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { PROJECT } from "@/lib/project";

const labelMap: Record<string, string> = {
  DIRECT_SPONSOR: "Sponsor Income",
  CO_SPONSOR: "Co-Sponsor Income",
  SUPER_SPONSOR: "Super Sponsor Income",
  LEVEL_1: "Level 1 Income",
  LEVEL_2: "Level 2 Income",
  LEVEL_3: "Level 3 Income",
  LEVEL_4: "Level 4 Income",
  LEVEL_5: "Level 5 Income",
  LEVEL_6: "Level 6 Income",
  LEVEL_7: "Level 7 Income",
};

export default async function BusinessPlanPage() {
  const settings = await getAllSettings();
  const sponsorRules = DEFAULT_COMMISSION_RULES.filter((rule) => !rule.incomeType.startsWith("LEVEL"));
  const levelRules = DEFAULT_COMMISSION_RULES.filter((rule) => rule.incomeType.startsWith("LEVEL"));
  const totalIncome = DEFAULT_COMMISSION_RULES.reduce((sum, rule) => sum + Number(rule.fullAmount), 0);

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="Business Plan"
        title="Income, Matrix, Rank & Award Rules"
        description="Use this page to explain and test the plan logic: sponsor income, level income, two-leg matrix placement, ranks, awards, draw bonus, payout, and KYC conditions."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Project" value={PROJECT.siteName} sub={PROJECT.groupName} />
        <Stat label="Plot Area" value={`${PROJECT.plotAreaSqFt} sq ft`} sub={`${formatINR(PROJECT.ratePerSqFt)} per sq ft`} />
        <Stat label="Plot Value" value={formatINR(Number(settings.plot_price))} sub={`Booking ${formatINR(Number(settings.booking_amount))}`} />
        <Stat label="Total Income Pool" value={formatINR(totalIncome)} sub="Sponsor + level income" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sponsor Income</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Sponsor, co-sponsor, and super-sponsor income are calculated from the sponsor chain.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {sponsorRules.map((rule) => (
              <RuleRow key={rule.incomeType} label={labelMap[rule.incomeType]} depth={rule.uplineDepth} amount={Number(rule.fullAmount)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Level Income</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Seven-level income is calculated from the same sponsor chain and stacks with sponsor income.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {levelRules.map((rule) => (
              <RuleRow key={rule.incomeType} label={labelMap[rule.incomeType]} depth={rule.uplineDepth} amount={Number(rule.fullAmount)} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Two-Leg Matrix Placement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <PlanPoint title="Only Paid IDs Enter Structure" text="Free registrations stay in the approval list. After admin collects the token amount and approves the member, the ID enters the tree." />
          <PlanPoint title="Auto Placement" text="Paid IDs are placed left-to-right and top-to-bottom wherever the next space is available." />
          <PlanPoint title="Common Tree" text="The tree is common for all paid members. Referral decides sponsor income, not the physical placement slot." />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ranks & Awards</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Award label="Bronze" rule={`${settings.bronze_min_referrals} direct paid referrals`} gift="Draw bonus eligibility" />
            {Object.entries(PAIR_REWARD_LABELS).map(([key, reward]) => (
              <Award key={key} label={reward.rank} rule={reward.target} gift={reward.gift} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Draw, Payout & KYC Conditions</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <PlanPoint title="Bronze Draw Bonus" text="If a Bronze member's sponsored member wins a draw, the Bronze sponsor receives the same draw prize. Without Bronze rank, no sponsor draw bonus is paid." />
            <PlanPoint title="Payout Window" text={`Payment collection window is day ${settings.payment_window_start_day} to ${settings.payment_window_end_day}. Draw and payout processing is normally between the 5th and 10th.`} />
            <PlanPoint title="KYC Rule" text="KYC is required before admin pays income to the member. KYC is not required for the member to pay installments to admin." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RuleRow({ label, depth, amount }: { label: string; depth: number; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">Upline depth {depth}</div>
      </div>
      <Badge>{formatINR(amount)}</Badge>
    </div>
  );
}

function PlanPoint({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  );
}

function Award({ label, rule, gift }: { label: string; rule: string; gift: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-muted-foreground">{rule}</div>
      </div>
      <Badge tone="success">{gift}</Badge>
    </div>
  );
}
