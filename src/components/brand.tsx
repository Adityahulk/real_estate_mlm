import Link from "next/link";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-2">
      <span className="text-sm font-black uppercase tracking-[0.16em] text-foreground">Shree</span>
      <span className={compact ? "text-lg font-bold text-brand" : "text-xl font-bold text-brand"}>Shyam Villa–2</span>
    </Link>
  );
}

export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-5">
      {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</div>}
      <h1 className="text-2xl font-black uppercase sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 h-1 w-16 bg-brand" />
    </div>
  );
}
