import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Superficie base da interface. Toda informacao mora dentro de um card — e o
 * que da a hierarquia de profundidade sem precisar de borda pesada.
 */
export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  return (
    <Tag
      className={cn(
        "border-line bg-raised rounded-[var(--radius-card)] border shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6", className)}>
      <div className="min-w-0">
        <h2 className="text-content text-[15px] font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted mt-1 text-[13px] leading-snug">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-line text-muted border-t px-5 py-3 text-[13px] sm:px-6", className)}>
      {children}
    </div>
  );
}
