"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT } from "@/lib/project";

export type NavItem = { href: string; label: string };

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/member" && href !== "/admin" && pathname.startsWith(href));
}

export function MobileNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card text-foreground shadow-sm"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/20"
          />
          <nav className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-lg border bg-card p-2 shadow-xl">
            <div className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="grid gap-1 py-2">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm font-semibold",
                    isActivePath(pathname, item.href)
                      ? "border-l-brand bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

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
        <div className="relative mb-3 aspect-square overflow-hidden rounded-md border bg-black">
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
        const active = isActivePath(pathname, it.href);
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
