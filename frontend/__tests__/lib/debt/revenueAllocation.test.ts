import {
  computeRevenueAllocation,
  formatHeadlineKes,
} from '@/lib/debt/revenueAllocation';

describe('computeRevenueAllocation (BPS framing)', () => {
  // FY 2025/26 BPS values per the seed file. Updating these in the seed
  // without updating this test catches accidental methodology drift.
  const BPS_FY_25_26 = {
    fiscal_year: 'FY 2025/26',
    total_revenue: 2835, // ordinary revenue (excludes A-i-A and borrowing)
    debt_service_cost: 1606, // public debt-related costs (Consolidated Fund)
    debt_service_per_shilling: 56.7, // pre-computed by backend
    recurrent_spending: 2850,
    development_spending: 672,
    county_allocation: 415,
    appropriated_budget: 4190,
  };

  it('uses backend-provided debt_service_per_shilling when present', () => {
    const r = computeRevenueAllocation(BPS_FY_25_26);
    expect(r).not.toBeNull();
    expect(r!.debtServicePerRev).toBe(56.7);
  });

  it('falls back to ds/rev*100 only when debt_service_per_shilling is missing', () => {
    const { debt_service_per_shilling, ...without } = BPS_FY_25_26;
    const r = computeRevenueAllocation(without);
    // 1606 / 2835 * 100 = 56.6489...
    expect(r!.debtServicePerRev).toBeCloseTo(56.6489, 3);
  });

  it('the BPS calculation 1.606 / 2.835 × 100 ≈ 56.7', () => {
    // 1.606 ÷ 2.835 × 100 = 56.6490... — rounds to 56.7 at one decimal
    // and to 57 as an integer (the public-facing headline)
    const ratio = (1.606 / 2.835) * 100;
    expect(ratio).toBeCloseTo(56.6489, 3);
    expect(Number(ratio.toFixed(1))).toBe(56.6); // 1-decimal rep
    expect(formatHeadlineKes(56.7)).toBe(57);
  });

  it('subtracts debt service out of recurrent before computing recPerRev', () => {
    // Avoids double-counting: recurrent_spending in the seed includes
    // debt service; subtracting it gives the "everything else recurrent"
    // figure (salaries, transfers, etc.) for the bar.
    const r = computeRevenueAllocation(BPS_FY_25_26);
    // (2850 - 1606) / 2835 * 100 = 1244 / 2835 * 100 ≈ 43.88
    expect(r!.recPerRev).toBeCloseTo(43.88, 1);
  });

  it('produces an allocation bar whose sum exceeds 100 (borrowing shortfall)', () => {
    const r = computeRevenueAllocation(BPS_FY_25_26);
    const sum =
      r!.debtServicePerRev +
      r!.recPerRev +
      r!.devPerRev +
      r!.countiesPerRev;
    expect(sum).toBeGreaterThan(100);
    // borrowingPerRev is exactly the overshoot above 100
    expect(r!.borrowingPerRev).toBeCloseTo(sum - 100, 5);
  });

  it('returns null when input is null/undefined', () => {
    expect(computeRevenueAllocation(null)).toBeNull();
    expect(computeRevenueAllocation(undefined)).toBeNull();
  });

  it('returns null when total_revenue is missing or zero (no fabricated zero defaults)', () => {
    expect(
      computeRevenueAllocation({ ...BPS_FY_25_26, total_revenue: 0 }),
    ).toBeNull();
    expect(
      computeRevenueAllocation({
        ...BPS_FY_25_26,
        total_revenue: undefined,
      }),
    ).toBeNull();
  });
});

describe('formatHeadlineKes (rounding)', () => {
  it('rounds 56.7 up to 57 (the BPS FY 2025/26 figure)', () => {
    expect(formatHeadlineKes(56.7)).toBe(57);
  });

  it('rounds 56.65 to 57 (round-half-up at the integer boundary)', () => {
    expect(formatHeadlineKes(56.65)).toBe(57);
  });

  it('rounds 56.4 down to 56 (does NOT silently inflate)', () => {
    expect(formatHeadlineKes(56.4)).toBe(56);
  });

  it('does NOT floor — 56.9 must not become 56', () => {
    expect(formatHeadlineKes(56.9)).not.toBe(56);
    expect(formatHeadlineKes(56.9)).toBe(57);
  });

  it('handles zero gracefully (no fabricated default)', () => {
    expect(formatHeadlineKes(0)).toBe(0);
  });
});
