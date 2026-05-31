"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function SideNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {items.map((it) => {
        const active = pathname === it.href || (it.href !== "/member" && it.href !== "/admin" && pathname.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-muted"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
