"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, router]);

  const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));
  const isLow = remainingMs < 3 * 60_000;

  return (
    <p className={isLow ? "text-sm font-medium text-warning" : "text-sm text-muted-foreground"}>
      Pista reservada temporalmente. Completa el pago en{" "}
      <span className="font-semibold tabular-nums">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
      .
    </p>
  );
}
