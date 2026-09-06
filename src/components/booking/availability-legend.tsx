import { cn } from "@/lib/utils";

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
