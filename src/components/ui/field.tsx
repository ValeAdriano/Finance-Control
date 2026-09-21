"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "min-h-11 w-full rounded-[12px] border border-line bg-base px-3 text-[15px] text-content " +
  "transition-colors focus:border-accent focus:outline-none";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-muted text-[13px] font-medium">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-faint text-[12px] leading-snug">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "tabular", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn(CONTROL, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** Interruptor simples. O rotulo inteiro e clicavel, alvo bem acima de 44px. */
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="border-line flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[12px] border px-3">
      <span>
        <span className="text-content block text-[14px]">{label}</span>
        {hint ? <span className="text-faint block text-[12px]">{hint}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="bg-line peer-checked:bg-accent peer-focus-visible:outline-accent h-6 w-10 rounded-full transition-colors peer-focus-visible:outline-2" />
        <span className="bg-raised absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
