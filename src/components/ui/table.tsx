import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tabela de dado denso. Em telas estreitas a tabela rola na horizontal dentro
 * do card; onde a lista e longa, a tela usa cards em vez desta tabela.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <table className={cn("w-full min-w-[640px] border-collapse text-[14px]", className)}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-line text-faint border-b pb-2 text-[12px] font-medium tracking-wide uppercase",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-line text-content border-b py-3",
        align === "right" && "tabular text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("hover:bg-sunken/60 transition-colors", className)}>{children}</tr>;
}
