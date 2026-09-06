import * as React from "react";

import { cn } from "@/lib/utils";

/** Small uppercase terracotta kicker — `.eyebrow` in the reference. */
export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("eyebrow", className)} {...props} />;
}

/**
 * Page-level display heading in Fraunces. Wrap emphasised words in <em> for
 * the reference's italic-light treatment.
 */
export function PageHeading({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "display-em font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl",
        className
      )}
      {...props}
    />
  );
}
