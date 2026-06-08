import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, Building2, Car, Gift, MapPin, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui";
import { PROJECT } from "@/lib/project";

const reasons = [
  { icon: MapPin, title: "Prime Location", text: "Strategically located near the growing Panoli Industrial–Kosamba corridor." },
  { icon: Building2, title: "Road-Touch Project", text: "A 40-foot wide road-touch plotting project built for convenient access." },
  { icon: ShieldCheck, title: "Secure Future Asset", text: "Own land with long-term value for your family and future." },
  { icon: BadgeIndianRupee, title: "Growth Potential", text: "Affordable entry with strong appreciation potential." },
];

export default function Home() {
  return (
    <main>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="brand-rule" />
        <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-lg border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <Brand />
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">Member Login</Button></Link>
            <Link href="/register"><Button size="sm">Join Project</Button></Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-[690px] overflow-hidden bg-white">
        <Image src="/proposal/cover.png" alt="Shree Shyam Villa 2 residential project" fill priority className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-white/10" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-6 pb-12 text-white">
            <div className="max-w-xl border-l-4 border-brand pl-4">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Panoli Industrial · Kosamba</div>
              <h1 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Building Trust, Creating Futures</h1>
              <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">Own a premium 432 sq.ft. residential plot with flexible payments, transparent income, rewards, and family protection.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/register"><Button size="lg">Become a Member <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/login"><Button size="lg" variant="outline" className="border-white bg-white/10 text-white hover:bg-white/20">Member Login</Button></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-foreground py-5 text-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 text-center sm:grid-cols-4">
          <Fact value="432 Sq.Ft." label="Plot Size" />
          <Fact value="₹3,00,000" label="Plot Value" />
          <Fact value="₹10,000" label="Monthly EMI" />
          <Fact value="30 Months" label="Easy Installments" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionTitle eyebrow="The Project" title="Why Invest in Shree Shyam Villa–2?" text="A thoughtfully planned residential plotting project for families and investors seeking affordability, connectivity, and long-term value." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map(({ icon: Icon, title, text }) => (
            <div key={title} className="proposal-panel rounded-lg border-t-4 border-t-brand p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white"><Icon className="h-5 w-5" /></div>
              <h3 className="font-bold uppercase">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="Flexible Options" title="Choose Your Payment Plan" text="Easy process, transparent terms, and a secure investment." />
          <div className="grid gap-5 lg:grid-cols-2">
            <Plan label="Plan A" title="EMI Plan" amount="₹10,000" suffix="per month" lines={["30 monthly installments", "Total plot value ₹3,00,000", "Online and offline payment"]} />
            <Plan label="Plan B" title="Cashback Plan" amount="₹3,00,000" suffix="full payment" lines={["3% monthly cashback", "Cashback up to 34 months", "Plot benefit received separately"]} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 lg:grid-cols-3">
        <Feature icon={Gift} eyebrow="Lucky Draw" title="Five Prizes Every Draw" text="Win a 12×36 plot, mixer grinder, iron press, pressure cooker, or tea cup set." image="/proposal/draw.png" />
        <Feature icon={Car} eyebrow="Team Rewards" title="Grow and Unlock Rewards" text="Build balanced teams to unlock Honda Activa and four-wheeler achievements." image="/proposal/bronze.png" />
        <Feature icon={ShieldCheck} eyebrow="Family Security" title="Insurance Protection" text="After five regular EMIs, accidental death protection secures the plot for the nominee." image="/proposal/insurance.png" />
      </section>

      <section className="bg-foreground py-14 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Invest Today · Build Tomorrow</div>
            <h2 className="mt-2 text-3xl font-black uppercase">Secure Your Future With Land</h2>
          </div>
          <Link href="/register"><Button size="lg">Start Your Application <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </section>

      <footer className="border-t bg-white py-8 text-sm">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 px-6 sm:flex-row">
          <div><Brand /><p className="mt-2 text-xs text-muted-foreground">{PROJECT.office}</p></div>
          <div className="space-y-1 text-muted-foreground">
            {PROJECT.contacts.map((c) => <div key={c.phone}>{c.name} · <strong>{c.phone}</strong></div>)}
            <Link href="/admin/login" className="inline-block pt-2 text-brand">Admin Login</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return <div className="border-white/15 py-2 sm:border-r sm:last:border-0"><div className="text-xl font-black text-orange-300">{value}</div><div className="text-xs font-bold uppercase tracking-wide text-white/65">{label}</div></div>;
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="mb-8 max-w-2xl"><div className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</div><h2 className="mt-2 text-3xl font-black uppercase sm:text-4xl">{title}</h2><div className="my-4 h-1 w-16 bg-brand" /><p className="text-sm leading-relaxed text-muted-foreground">{text}</p></div>;
}

function Plan({ label, title, amount, suffix, lines }: { label: string; title: string; amount: string; suffix: string; lines: string[] }) {
  return <div className="proposal-panel rounded-lg border-2 border-brand p-6"><span className="rounded-md bg-brand px-3 py-1 text-xs font-bold uppercase text-white">{label}</span><h3 className="mt-5 text-xl font-black uppercase">{title}</h3><div className="mt-4 text-4xl font-black">{amount}</div><div className="text-sm font-bold uppercase text-brand">{suffix}</div><div className="mt-5 border-t pt-4">{lines.map((line) => <div key={line} className="border-b py-2 text-sm font-medium last:border-0">{line}</div>)}</div></div>;
}

function Feature({ icon: Icon, eyebrow, title, text, image }: { icon: typeof Gift; eyebrow: string; title: string; text: string; image: string }) {
  return <article className="proposal-panel rounded-lg"><div className="relative aspect-[16/9] overflow-hidden"><Image src={image} alt={title} fill className="object-cover" /></div><div className="p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand"><Icon className="h-4 w-4" />{eyebrow}</div><h3 className="mt-2 text-lg font-black uppercase">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></div></article>;
}
