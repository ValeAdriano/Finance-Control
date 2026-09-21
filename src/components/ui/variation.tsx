import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { signedBrl, signedPercent, trend } from "@/lib/format";

/**
 * Exibicao de variacao. Sempre com seta e sinal alem da cor: quem nao
 * distingue verde de vermelho precisa conseguir ler a direcao mesmo assim.
 */
export function Variation({
  value,
  kind = "percent",
  size = "md",
  className,
}: {
  value: number;
  kind?: "percent" | "brl";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const direction = trend(value);
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 font-medium",
        direction === "up" && "text-positive",
        direction === "down" && "text-negative",
        direction === "flat" && "text-muted",
        size === "sm" && "text-[12px]",
        size === "md" && "text-[14px]",
        size === "lg" && "text-[17px]",
        className,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "size-3.5" : "size-4"} />
      {kind === "percent" ? signedPercent(value) : signedBrl(value)}
    </span>
  );
}
