"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "dark", label: "Escuro", Icon: Moon },
] as const;

/** Nunca emite — so serve para o snapshot do servidor diferir do cliente. */
const neverChanges = () => () => {};

/**
 * Seletor de tema. O tema resolvido so existe no cliente, entao o componente
 * so pinta a selecao depois de hidratar — marcar a opcao no HTML do servidor
 * causaria divergencia de hidratacao.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  return (
    <div
      className="border-line bg-raised flex items-center gap-0.5 rounded-full border p-0.5"
      role="radiogroup"
      aria-label="Tema da interface"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors",
              selected ? "bg-sunken text-content" : "text-faint hover:text-content",
            )}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
