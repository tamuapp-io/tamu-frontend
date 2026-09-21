/**
 * What a venue's table/section amounts are called and how much is taken online.
 *
 * Mirrors config/booking.php and App\Services\Booking\BookingChargeSettings —
 * the server is the authority, and these helpers exist so the pricing screen
 * and the guest booking page agree on the wording and on the arithmetic without
 * each inventing their own.
 */

export type BookingChargeType = "table_fee" | "minimum_spend";
export type BookingDepositMode = "full" | "percent";

export interface BookingChargeConfig {
  type: BookingChargeType;
  deposit_mode: BookingDepositMode;
  /** 1–100. Always 100 when the mode is `full`, so callers need no branch. */
  deposit_percent: number;
}

export const DEFAULT_BOOKING_CHARGE: BookingChargeConfig = {
  type: "table_fee",
  deposit_mode: "full",
  deposit_percent: 100,
};

/** Reads a charge config out of anything server-shaped, defaults and all. */
export function bookingCharge(raw: unknown): BookingChargeConfig {
  const r = (raw ?? {}) as Record<string, unknown>;

  const type: BookingChargeType = r.type === "minimum_spend" || r.charge_type === "minimum_spend"
    ? "minimum_spend"
    : "table_fee";

  const mode: BookingDepositMode = r.deposit_mode === "percent" ? "percent" : "full";

  // Anything unusable resolves to the full amount, exactly as the server does:
  // overcharging is visible and refundable, undercharging gives tables away.
  const stored = Number(r.deposit_percent);
  const percent =
    mode === "percent" && Number.isInteger(stored) && stored >= 1 && stored <= 100
      ? stored
      : 100;

  return { type, deposit_mode: mode, deposit_percent: percent };
}

/** What a guest pays now for an amount worth `valueCents`. Rounds up, as the server does. */
export function depositCentsFromValue(valueCents: number, charge: BookingChargeConfig): number {
  if (valueCents <= 0) return 0;
  if (charge.deposit_percent >= 100) return valueCents;
  return Math.max(1, Math.ceil((valueCents * charge.deposit_percent) / 100));
}

/** "Table fee" / "Minimum spend", for staff screens. */
export function chargeTypeLabel(type: BookingChargeType): string {
  return type === "minimum_spend" ? "Minimum spend" : "Table fee";
}

/**
 * What a guest is told about an amount, in one sentence.
 *
 * Kept here rather than in the step components because the same wording has to
 * hold for a single table and for a group, and the four combinations of type ×
 * mode are exactly the kind of thing that drifts when written twice. Takes a
 * money formatter so this module stays free of currency concerns.
 */
export function chargeSentence(
  valueCents: number,
  charge: BookingChargeConfig,
  money: (cents: number) => string,
): string {
  const now = depositCentsFromValue(valueCents, charge);
  const later = valueCents - now;
  const minimum = charge.type === "minimum_spend";

  if (later <= 0) {
    return minimum
      ? `${money(valueCents)} minimum spend, paid now and credited to your bill.`
      : `${money(valueCents)}, paid now to confirm your booking.`;
  }

  return minimum
    ? `${money(valueCents)} minimum spend. ${money(now)} now, credited to your bill — the rest settled at the venue.`
    : `${money(valueCents)}. ${money(now)} now to confirm your booking, ${money(later)} at the venue.`;
}
