"use client";

import type { BookingFlow } from "../_use-booking-flow";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "Fri 25 Sep" from a "YYYY-MM-DD" venue-local date.
 *
 * Built from the parts rather than `new Date(iso)`, which parses a bare date as
 * UTC midnight and then formats it in the viewer's zone — showing the previous
 * day to anyone west of UTC, on the one line of the page that must not be
 * wrong.
 */
function formatVenueDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const at = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[at.getUTCDay()]} ${d} ${MONTHS_SHORT[m - 1]}`;
}

export interface SummaryRow {
  label: string;
  value: string;
}

/**
 * What the guest has chosen so far — the running total the two panelled themes
 * keep in view. Rows appear as they are decided; nothing is shown as "—",
 * because an empty value reads as a field they failed to fill rather than one
 * they have not reached.
 */
export function summaryRows(flow: BookingFlow): SummaryRow[] {
  const { state, venue } = flow;
  const rows: SummaryRow[] = [{ label: "Date", value: formatVenueDate(state.date) }];

  if (state.slot) rows.push({ label: "Time", value: state.slot.time });

  if (venue.uses_party_size !== false) {
    rows.push({
      label: venue.terminology?.party ?? "Guests",
      value: String(state.party_size),
    });
  }

  if (state.section_name) rows.push({ label: "Area", value: state.section_name });

  return rows;
}

export function BookingSummary({
  flow,
  tone = "panel",
}: {
  flow: BookingFlow;
  /** `panel` sits on --bk-panel; `surface` sits on a card. */
  tone?: "panel" | "surface";
}) {
  const rows = summaryRows(flow);
  const labelColor = tone === "panel" ? "text-[var(--bk-panel-muted)]" : "text-[var(--bk-muted)]";
  const valueColor = tone === "panel" ? "text-[var(--bk-panel-text)]" : "text-[var(--bk-text)]";

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className={`text-xs ${labelColor}`}>{row.label}</dt>
          <dd
            className={`mt-1 font-[family-name:var(--bk-font-display)] text-xl ${valueColor}`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
