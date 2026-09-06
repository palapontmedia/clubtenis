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
