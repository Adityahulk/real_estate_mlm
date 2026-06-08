"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROJECT } from "@/lib/project";

export type NavItem = { href: string; label: string };

export function SideNav({
  items,
  title,
  matrix,
}: {
  items: NavItem[];
  title: string;
  matrix?: { label: string; left: number; right: number; rank?: string };
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 rounded-lg border bg-card p-2 shadow-sm">
      <div className="border-b p-3">
        <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-md border bg-muted">
          <Image src={PROJECT.groupPhotoUrl} alt={PROJECT.groupName} fill className="object-cover" />
        </div>
        <div className="text-sm font-black uppercase">{PROJECT.groupName}</div>
        <div className="text-xs font-bold uppercase tracking-wide text-brand">{PROJECT.siteName}</div>
        {matrix && (
          <div className="mt-3 rounded-md border bg-muted/50 p-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{matrix.label}</div>
            <div className="mt-1 flex items-center justify-between text-sm font-black">
              <span>L {matrix.left}</span>
              <span>R {matrix.right}</span>
            </div>
            {matrix.rank && matrix.rank !== "NONE" && <div className="mt-1 text-[10px] font-bold uppercase text-brand">Rank {matrix.rank}</div>}
          </div>
        )}
      </div>
      <div className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
      {items.map((it) => {
        const active = pathname === it.href || (it.href !== "/member" && it.href !== "/admin" && pathname.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-semibold transition",
              active ? "border-l-brand bg-muted text-foreground" : "text-muted-foreground hover:border-l-brand/40 hover:bg-muted"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
