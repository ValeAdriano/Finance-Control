import { cn } from "@/lib/cn";

/**
 * Barra de progresso usada em orcamento e meta de alocacao. Aceita passar de
 * 100% de proposito — estouro de orcamento precisa aparecer, nao ser cortado.
 */
export function Progress({
  value,
  tone = "accent",
  label,
  className,
}: {
  /** Fracao, onde 1 = 100%. */
  value: number;
  tone?: "accent" | "positive" | "negative" | "warning";
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const overflow = value > 1;

  return (
    <div
      className={cn("bg-sunken h-1.5 w-full overflow-hidden rounded-full", className)}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "accent" && "bg-accent",
          tone === "positive" && "bg-positive",
          tone === "negative" && "bg-negative",
          tone === "warning" && "bg-warning",
          overflow && "bg-negative",
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
