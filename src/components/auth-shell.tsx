import Image from "next/image";
import { Brand } from "@/components/brand";

export function AuthShell({ eyebrow, title, description, children, wide = false }: { eyebrow: string; title: string; description: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-foreground lg:block">
        <Image src="/proposal/cover.png" alt="Shree Shyam Villa 2" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <div className="border-l-4 border-brand pl-4">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Building Trust, Creating Futures</div>
            <div className="mt-2 text-2xl font-black uppercase">Premium plots at Panoli Industrial–Kosamba</div>
          </div>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className={wide ? "w-full max-w-3xl" : "w-full max-w-md"}>
          <Brand />
          <div className="mt-8 border-l-4 border-brand pl-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</div>
            <h1 className="mt-1 text-3xl font-black uppercase">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
