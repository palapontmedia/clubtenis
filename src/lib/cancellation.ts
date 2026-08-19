import { prisma } from "@/lib/prisma";

export interface CancellationTier {
  minHoursBefore: number;
  refundPercentage: number;
}

/**
 * Pure function: given a club's cancellation policy tiers and how many
 * hours remain before the reservation starts, returns the refund
 * percentage that applies. Tiers are matched by the largest
 * `minHoursBefore` the reservation still satisfies — e.g. tiers
 * [{24h -> 100%}, {12h -> 50%}, {0h -> 0%}] give 100% at 30h notice, 50% at
 * 18h notice, and 0% at 3h notice.
 *
 * Kept side-effect-free and separate from the DB/Stripe orchestration in
 * reservations.ts / payments.ts so the policy math itself is trivial to
 * unit test.
 */
export function computeRefundPercentage(tiers: CancellationTier[], hoursUntilStart: number): number {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
  const applicable = sorted.find((t) => hoursUntilStart >= t.minHoursBefore);
  return applicable?.refundPercentage ?? 0;
}

export async function getDefaultCancellationPolicy(clubId: string) {
  return prisma.cancellationPolicy.findFirst({
    where: { clubId, isDefault: true },
    include: { tiers: true },
  });
}
