import { describe, expect, it } from "vitest";

import { computeRefundPercentage } from "@/lib/cancellation";

const TIERS = [
  { minHoursBefore: 24, refundPercentage: 100 },
  { minHoursBefore: 12, refundPercentage: 50 },
  { minHoursBefore: 0, refundPercentage: 0 },
];

describe("computeRefundPercentage", () => {
  it("gives full refund well in advance", () => {
    expect(computeRefundPercentage(TIERS, 48)).toBe(100);
  });

  it("gives full refund exactly at the 24h boundary", () => {
    expect(computeRefundPercentage(TIERS, 24)).toBe(100);
  });

  it("gives partial refund between tiers", () => {
    expect(computeRefundPercentage(TIERS, 18)).toBe(50);
  });

  it("gives no refund just before the last-minute boundary", () => {
    expect(computeRefundPercentage(TIERS, 3)).toBe(0);
  });

  it("gives no refund with no notice at all", () => {
    expect(computeRefundPercentage(TIERS, 0)).toBe(0);
  });

  it("returns 0 when there are no tiers configured", () => {
    expect(computeRefundPercentage([], 48)).toBe(0);
  });

  it("is not fooled by tiers passed out of order", () => {
    const shuffled = [TIERS[1], TIERS[2], TIERS[0]];
    expect(computeRefundPercentage(shuffled, 30)).toBe(100);
    expect(computeRefundPercentage(shuffled, 15)).toBe(50);
  });
});
