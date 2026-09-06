import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Page width + horizontal gutters, matching the reference site
 * (`max-width: 1280px`, 40px side padding, 24px on small screens).
 * Replaces the repeated `mx-auto max-w-6xl px-4` pattern.
 */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-[1280px] px-6 sm:px-10", className)} {...props} />
  );
}
