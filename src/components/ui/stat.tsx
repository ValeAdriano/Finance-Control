import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** KPI da home. Rotulo pequeno em cima, numero grande embaixo, contexto depois. */
export function Stat({
  label,
  value,
  hint,
  trailing,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-faint text-[12px] font-medium tracking-wide uppercase">{label}</span>
      <span className="tabular text-content text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">
        {value}
      </span>
      {hint || trailing ? (
        <span className="text-muted flex flex-wrap items-center gap-2 text-[13px]">
          {trailing}
          {hint}
        </span>
      ) : null}
    </div>
  );
}
