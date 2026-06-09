import Link from "next/link";
import Image from "next/image";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <Image
        src="/shree-shyam-group-logo.png"
        alt="Shree Shyam Group"
        width={compact ? 42 : 54}
        height={compact ? 42 : 54}
        className="rounded-md object-cover"
        priority
      />
      <span className="leading-tight">
        <span className={compact ? "block text-sm font-black uppercase" : "block text-base font-black uppercase"}>Shree Shyam Group</span>
        <span className="block text-xs font-bold uppercase tracking-wide text-brand">Shyam Villa–2</span>
      </span>
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
