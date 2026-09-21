import type { ReactNode } from "react";

/**
 * Cabecalho de tela. Descricao curta explicando o que a tela faz — parte do
 * disclosure progressivo: a home nao precisa explicar o simulador, a tela do
 * simulador precisa.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-content text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted mt-1.5 max-w-[68ch] text-[15px] leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
