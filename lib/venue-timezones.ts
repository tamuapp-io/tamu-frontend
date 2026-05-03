/** Sentinel for Radix Select when value is any IANA string not in the preset list. */
export const CUSTOM_TIMEZONE_SELECT_VALUE = "__custom__";

export type VenueTimezoneGroup = {
  label: string;
  zones: readonly { value: string; label: string }[];
};

/** Curated presets (full IANA IDs). Guests can pick “Custom…” for any Zoneinfo name. */
export const VENUE_TIMEZONE_GROUPS: readonly VenueTimezoneGroup[] = [
  {
    label: "Indonesia",
    zones: [
      { value: "Asia/Jakarta", label: "WIB · Western (Jakarta, Java, Sumatra) — UTC+7" },
      { value: "Asia/Makassar", label: "WITA · Central (Bali, Sulawesi, Nusa Tenggara) — UTC+8" },
      { value: "Asia/Jayapura", label: "WIT · Eastern (Papua) — UTC+9" },
    ],
  },
  {
    label: "Southeast Asia & Oceania",
    zones: [
      { value: "Asia/Singapore", label: "Singapore — UTC+8" },
      { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur — UTC+8" },
      { value: "Asia/Manila", label: "Manila — UTC+8" },
      { value: "Asia/Bangkok", label: "Bangkok — UTC+7" },
      { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh — UTC+7" },
      { value: "Australia/Sydney", label: "Sydney — AEDT/AEST" },
      { value: "Australia/Melbourne", label: "Melbourne — AEDT/AEST" },
      { value: "Pacific/Auckland", label: "Auckland — NZDT/NZST" },
    ],
  },
  {
    label: "East Asia",
    zones: [
      { value: "Asia/Hong_Kong", label: "Hong Kong — UTC+8" },
      { value: "Asia/Shanghai", label: "China — CST" },
      { value: "Asia/Tokyo", label: "Tokyo — UTC+9" },
      { value: "Asia/Seoul", label: "Seoul — UTC+9" },
      { value: "Asia/Taipei", label: "Taipei — UTC+8" },
    ],
  },
  {
    label: "South Asia",
    zones: [
      { value: "Asia/Kolkata", label: "India — IST" },
      { value: "Asia/Dubai", label: "Dubai — UTC+4" },
    ],
  },
  {
    label: "Europe & Africa",
    zones: [
      { value: "Europe/London", label: "London — GMT/BST" },
      { value: "Europe/Paris", label: "Paris — CET/CEST" },
      { value: "Europe/Berlin", label: "Berlin — CET/CEST" },
      { value: "Europe/Amsterdam", label: "Amsterdam — CET/CEST" },
      { value: "Africa/Johannesburg", label: "Johannesburg — SAST" },
    ],
  },
  {
    label: "Americas",
    zones: [
      { value: "America/New_York", label: "US Eastern — ET" },
      { value: "America/Chicago", label: "US Central — CT" },
      { value: "America/Denver", label: "US Mountain — MT" },
      { value: "America/Los_Angeles", label: "US Pacific — PT" },
      { value: "America/Sao_Paulo", label: "São Paulo — BRT" },
    ],
  },
  {
    label: "Global",
    zones: [{ value: "UTC", label: "UTC (no offset)" }],
  },
];

const presetSet = new Set(
  VENUE_TIMEZONE_GROUPS.flatMap((g) => g.zones.map((z) => z.value)),
);

export function isPresetVenueTimezone(iana: string): boolean {
  return presetSet.has(iana.trim());
}

/** Browser IANA zone (client-only trustworthy). */
export function getBrowserSuggestedTimezone(): string | undefined {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat === "undefined") return undefined;
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof z === "string" && z.length > 0 ? z : undefined;
  } catch {
    return undefined;
  }
}
