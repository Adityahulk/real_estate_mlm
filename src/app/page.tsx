import Link from "next/link";
import { Button } from "@/components/ui";
import { PROJECT } from "@/lib/project";

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="bg-brand-gradient text-brand-foreground">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center">
          <span className="rounded-full bg-white/30 px-3 py-1 text-xs font-semibold">Surat, Gujarat</span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Shree Shyam Villa – 2</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed opacity-90">
            Own a 12×36 plot, pay in easy installments, and earn referral rewards as your team grows.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register">
              <Button size="lg" className="bg-white text-brand-foreground">Join Now</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/60 bg-transparent text-brand-foreground">
                Member Login
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-6 py-12 sm:grid-cols-3">
        {[
          { t: "Plot = Membership", d: "Each plot owner gets a unique Member ID equal to their plot number." },
          { t: "Flexible Payments", d: "Pay a small booking amount and easy monthly installments — online or offline." },
          { t: "Referral Income", d: "Earn points across your sponsor chain. Converted to cash every month." },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="text-lg font-semibold">{f.t}</div>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            {PROJECT.contacts.map((c) => (
              <span key={c.phone}>{c.role}: <strong>{c.name}</strong> · {c.phone}</span>
            ))}
          </div>
          <p className="mt-2 text-xs">{PROJECT.office}</p>
          <p className="mt-4">
            <Link href="/admin/login" className="hover:underline">Admin Login</Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
