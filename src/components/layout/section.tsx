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
  /** Center the block and its text instead of the default left alignment. */
  centered?: boolean;
  className?: string;
}

/** `.section__head` — eyebrow + display heading (with optional italic <em>) + lead. */
export function SectionHead({ eyebrow, title, lead, centered = false, className }: SectionHeadProps) {
  const hasBody = Boolean(title || lead);
  return (
    <div
      className={cn(
        "max-w-[640px]",
        hasBody ? "mb-10 sm:mb-14" : "mb-8",
        centered && "mx-auto text-center",
        className
      )}
    >
      {eyebrow ? <p className={cn("eyebrow", hasBody && "mb-4")}>{eyebrow}</p> : null}
      {title ? (
        <h2 className="display-em font-display text-3xl font-normal leading-[1.1] text-foreground sm:text-[45px]">
          {title}
        </h2>
      ) : null}
      {lead ? (
        <p className={cn("mt-4 max-w-[560px] text-lg text-foreground/80", centered && "mx-auto")}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}
