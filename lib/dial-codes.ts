/**
 * Curated dial-code list for the guest phone input.
 *
 * Indonesia first (primary market), then ASEAN + East Asia + Oceania,
 * then the most common Western/Middle-East options. We deliberately keep
 * this short — ~30 entries — so the dropdown stays usable on mobile;
 * tenants outside these regions can still type a value because the field
 * accepts a custom dial code via the "Other…" sentinel.
 */

export type DialCodeOption = {
  /** ISO 3166-1 alpha-2 (used internally only). */
  iso2: string;
  /** Country dial code without the leading "+". */
  code: string;
  /** Country display name. */
  name: string;
  /** Emoji flag, displayed in the trigger. */
  flag: string;
};

export const DIAL_CODES: readonly DialCodeOption[] = [
  { iso2: "ID", code: "62", name: "Indonesia", flag: "🇮🇩" },
  { iso2: "SG", code: "65", name: "Singapore", flag: "🇸🇬" },
  { iso2: "MY", code: "60", name: "Malaysia", flag: "🇲🇾" },
  { iso2: "TH", code: "66", name: "Thailand", flag: "🇹🇭" },
  { iso2: "VN", code: "84", name: "Vietnam", flag: "🇻🇳" },
  { iso2: "PH", code: "63", name: "Philippines", flag: "🇵🇭" },
  { iso2: "MM", code: "95", name: "Myanmar", flag: "🇲🇲" },
  { iso2: "KH", code: "855", name: "Cambodia", flag: "🇰🇭" },
  { iso2: "LA", code: "856", name: "Laos", flag: "🇱🇦" },
  { iso2: "BN", code: "673", name: "Brunei", flag: "🇧🇳" },
  { iso2: "TL", code: "670", name: "Timor-Leste", flag: "🇹🇱" },
  { iso2: "JP", code: "81", name: "Japan", flag: "🇯🇵" },
  { iso2: "KR", code: "82", name: "South Korea", flag: "🇰🇷" },
  { iso2: "CN", code: "86", name: "China", flag: "🇨🇳" },
  { iso2: "HK", code: "852", name: "Hong Kong", flag: "🇭🇰" },
  { iso2: "TW", code: "886", name: "Taiwan", flag: "🇹🇼" },
  { iso2: "IN", code: "91", name: "India", flag: "🇮🇳" },
  { iso2: "AU", code: "61", name: "Australia", flag: "🇦🇺" },
  { iso2: "NZ", code: "64", name: "New Zealand", flag: "🇳🇿" },
  { iso2: "US", code: "1", name: "United States / Canada", flag: "🇺🇸" },
  { iso2: "GB", code: "44", name: "United Kingdom", flag: "🇬🇧" },
  { iso2: "DE", code: "49", name: "Germany", flag: "🇩🇪" },
  { iso2: "FR", code: "33", name: "France", flag: "🇫🇷" },
  { iso2: "NL", code: "31", name: "Netherlands", flag: "🇳🇱" },
  { iso2: "AE", code: "971", name: "United Arab Emirates", flag: "🇦🇪" },
  { iso2: "SA", code: "966", name: "Saudi Arabia", flag: "🇸🇦" },
  { iso2: "QA", code: "974", name: "Qatar", flag: "🇶🇦" },
] as const;

export const DEFAULT_DIAL_CODE: DialCodeOption = DIAL_CODES[0];

/** Sentinel value selected when none of the curated codes match. */
export const CUSTOM_DIAL_CODE_VALUE = "__custom__";

/** IANA tz → best-effort dial code. Anything not listed defaults to Indonesia. */
const TIMEZONE_TO_DIAL_CODE: Record<string, string> = {
  "Asia/Jakarta": "62",
  "Asia/Makassar": "62",
  "Asia/Jayapura": "62",
  "Asia/Pontianak": "62",
  "Asia/Singapore": "65",
  "Asia/Kuala_Lumpur": "60",
  "Asia/Kuching": "60",
  "Asia/Bangkok": "66",
  "Asia/Ho_Chi_Minh": "84",
  "Asia/Manila": "63",
  "Asia/Yangon": "95",
  "Asia/Phnom_Penh": "855",
  "Asia/Vientiane": "856",
  "Asia/Brunei": "673",
  "Asia/Dili": "670",
  "Asia/Tokyo": "81",
  "Asia/Seoul": "82",
  "Asia/Shanghai": "86",
  "Asia/Hong_Kong": "852",
  "Asia/Taipei": "886",
  "Asia/Kolkata": "91",
  "Australia/Sydney": "61",
  "Australia/Melbourne": "61",
  "Australia/Brisbane": "61",
  "Australia/Perth": "61",
  "Australia/Adelaide": "61",
  "Pacific/Auckland": "64",
  "America/New_York": "1",
  "America/Los_Angeles": "1",
  "America/Chicago": "1",
  "America/Denver": "1",
  "America/Toronto": "1",
  "Europe/London": "44",
  "Europe/Berlin": "49",
  "Europe/Paris": "33",
  "Europe/Amsterdam": "31",
  "Asia/Dubai": "971",
  "Asia/Riyadh": "966",
  "Asia/Qatar": "974",
};

/** Return the dial code that best matches an IANA timezone (without leading "+"). */
export function dialCodeForTimezone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_DIAL_CODE.code;
  return TIMEZONE_TO_DIAL_CODE[tz] ?? DEFAULT_DIAL_CODE.code;
}

/** Best-effort guess based on the visitor's own browser locale. */
export function dialCodeFromBrowser(): string {
  if (typeof Intl === "undefined") return DEFAULT_DIAL_CODE.code;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return dialCodeForTimezone(tz);
  } catch {
    return DEFAULT_DIAL_CODE.code;
  }
}

/**
 * Strip leading "+" and non-digits, then strip a single leading "0" (Indonesia
 * / SEA convention where "0812…" is shorthand for the dial code + "812…").
 */
export function sanitizeNationalNumber(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

/**
 * Greedy split of an E.164-ish string into [dialCode, national]. We try to
 * match against the curated list (longest prefix wins) so the dropdown
 * defaults to the right entry when re-rendering an existing value.
 */
export function splitE164(value: string): { dial: string; national: string } {
  const raw = value.trim();
  if (!raw) return { dial: "", national: "" };

  const withPlus = raw.startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (digits === "") return { dial: "", national: "" };

  if (withPlus || raw.length > 4) {
    const sorted = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
    for (const opt of sorted) {
      if (digits.startsWith(opt.code)) {
        return { dial: opt.code, national: digits.slice(opt.code.length) };
      }
    }
  }
  return { dial: "", national: sanitizeNationalNumber(digits) };
}

/** Compose "+{dial}{national}" canonical E.164. Returns "" when nothing entered. */
export function joinE164(dial: string, national: string): string {
  const d = dial.replace(/\D+/g, "");
  const n = sanitizeNationalNumber(national);
  if (!d || !n) return "";
  return `+${d}${n}`;
}

export function isPresetDialCode(code: string): boolean {
  return DIAL_CODES.some((d) => d.code === code);
}
