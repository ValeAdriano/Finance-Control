"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { isActive, PRIMARY_NAV, SECONDARY_NAV } from "./nav";

/**
 * Barra inferior do mobile: quatro destinos principais mais um "Mais" que
 * abre o restante. Mantem tudo a no maximo dois toques.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const secondaryActive = SECONDARY_NAV.some((item) => isActive(pathname, item.href));

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <div className="animate-fade-up border-line bg-raised absolute right-0 bottom-0 left-0 rounded-t-[22px] border-t p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-content text-[15px] font-semibold">Mais</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-muted hover:bg-sunken flex size-9 items-center justify-center rounded-full"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="grid gap-1">
              {SECONDARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-[12px] px-3 text-[15px]",
                    isActive(pathname, item.href)
                      ? "bg-accent-soft text-accent font-medium"
                      : "text-content hover:bg-sunken",
                  )}
                >
                  <item.icon aria-hidden className="text-muted size-5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Navegação principal"
        className="border-line bg-overlay fixed inset-x-0 bottom-0 z-30 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
                active ? "text-accent font-medium" : "text-faint",
              )}
            >
              <item.icon aria-hidden className="size-[22px]" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={cn(
            "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
            secondaryActive ? "text-accent font-medium" : "text-faint",
          )}
        >
          <MoreHorizontal aria-hidden className="size-[22px]" />
          Mais
        </button>
      </nav>
    </>
  );
}
