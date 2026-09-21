import { cn } from "@/lib/cn";

/**
 * Lista de barras horizontais em HTML puro, usada onde ha poucas categorias
 * com rotulo: alocacao por classe, gasto por categoria.
 *
 * E deliberadamente uma lista, nao um grafico de pizza — comparar angulo e
 * mais dificil que comparar comprimento, e aqui todo valor aparece escrito ao
 * lado da barra, que e a garantia de leitura exigida pela paleta clara.
 */
export interface BarListItem {
  label: string;
  value: number;
  formattedValue: string;
  /** Texto secundario a direita (participacao, meta, variacao). */
  hint?: string;
  color: string;
  href?: string;
}

export function BarList({ items, className }: { items: BarListItem[]; className?: string }) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-content flex min-w-0 items-center gap-2 text-[14px]">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="tabular text-content text-[14px] font-medium">
                {item.formattedValue}
              </span>
              {item.hint ? (
                <span className="tabular text-faint text-[12px]">{item.hint}</span>
              ) : null}
            </span>
          </div>
          <div className="bg-sunken h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max === 0 ? 0 : (item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
