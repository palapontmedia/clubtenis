import * as React from "react";

import { cn } from "@/lib/utils";
import { Container } from "./container";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Parchment → aged-paper background, like `.section--alt` in the reference. */
  alt?: boolean;
  /** Render the inner Container, on by default. Set false for full-bleed content. */
  bleed?: boolean;
  containerClassName?: string;
}

export function Section({
  alt = false,
  bleed = false,
  className,
  containerClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn("py-16 sm:py-20", alt ? "bg-surface-muted" : "bg-background", className)}
      {...props}
    >
      {bleed ? children : <Container className={containerClassName}>{children}</Container>}
    </section>
  );
}

interface SectionHeadProps {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
}

/** `.section__head` — eyebrow + display heading (with optional italic <em>) + lead. */
export function SectionHead({ eyebrow, title, lead, className }: SectionHeadProps) {
  return (
    <div className={cn("mb-10 max-w-[640px] sm:mb-14", className)}>
      {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
      {title ? (
        <h2 className="display-em font-display text-3xl font-normal leading-[1.1] text-foreground sm:text-[45px]">
          {title}
        </h2>
      ) : null}
      {lead ? <p className="mt-4 max-w-[560px] text-lg text-foreground/80">{lead}</p> : null}
    </div>
  );
}
