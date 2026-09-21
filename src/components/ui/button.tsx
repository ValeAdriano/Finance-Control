import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-content hover:bg-accent-hover",
  secondary: "bg-sunken text-content hover:bg-line",
  ghost: "text-muted hover:bg-sunken hover:text-content",
};

/** Alvo de toque de 44px e transicao curta — padrao da plataforma Apple. */
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium " +
  "transition-[background-color,color,transform] duration-200 active:scale-[0.98] " +
  "disabled:pointer-events-none disabled:opacity-50";

export function Button({
  children,
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button className={cn(BASE, VARIANT[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "secondary",
  className,
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(BASE, VARIANT[variant], className)}>
      {children}
    </Link>
  );
}
