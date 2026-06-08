"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function SideNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 rounded-lg border bg-card p-2 shadow-sm">
      <div className="border-b px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-wide text-brand">{title}</div>
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
