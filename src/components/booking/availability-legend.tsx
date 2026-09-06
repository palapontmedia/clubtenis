import * as React from "react";

import { cn } from "@/lib/utils";

export type SlotState = "free" | "busy" | "selected";

/**
 * Presentational classes for an availability slot, mirroring the reference
 * site's `.slot-btn` states. Pure styling — never decides availability.
 */
export function slotStateClasses(state: SlotState) {
  switch (state) {
    case "busy":
      return "cursor-not-allowed bg-surface-muted text-muted-foreground";
    case "selected":
      return "bg-primary text-primary-foreground";
    case "free":
    default:
      return "text-primary hover:bg-primary/10";
  }
}

interface SlotButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state: SlotState;
}

/** Compact slot button used in availability grids. */
export function SlotButton({ state, className, disabled, ...props }: SlotButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled ?? state === "busy"}
      className={cn(
        "h-11 w-full px-1.5 text-[11px] font-semibold transition-colors",
        slotStateClasses(state),
        className
      )}
      {...props}
    />
  );
}

function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", className)} />;
}

/** `.booking__legend` — key for the free / busy / selected slot colours. */
export function AvailabilityLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-6 text-sm text-foreground/80", className)}>
      <span className="inline-flex items-center gap-2">
        <Dot className="border-[1.5px] border-primary bg-background" /> Disponible
      </span>
      <span className="inline-flex items-center gap-2">
        <Dot className="bg-border" /> Ocupada
      </span>
      <span className="inline-flex items-center gap-2">
        <Dot className="bg-primary" /> Tu selección
      </span>
    </div>
  );
}
