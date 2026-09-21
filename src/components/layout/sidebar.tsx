"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_GROUPS } from "./nav";

/** Navegacao lateral do desktop. No mobile ela da lugar a barra inferior. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="border-line bg-raised/60 hidden w-60 shrink-0 flex-col gap-6 border-r px-3 py-6 lg:flex"
    >
      <Link href="/" className="flex items-center gap-2.5 px-3">
        <span className="bg-accent text-accent-content flex size-8 items-center justify-center rounded-[10px] text-[15px] font-semibold">
          F
        </span>
        <span className="text-content text-[15px] font-semibold tracking-tight">
          Finance Control
        </span>
      </Link>

      <div className="flex flex-col gap-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="text-faint px-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14px] transition-colors",
                    active
                      ? "bg-accent-soft text-accent font-medium"
                      : "text-muted hover:bg-sunken hover:text-content",
                  )}
                >
                  <item.icon aria-hidden className="size-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
