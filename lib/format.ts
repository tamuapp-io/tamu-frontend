/**
 * API instants should be UTC. If Laravel/Carbon emits a fractional datetime
 * WITHOUT `Z` or `±hh:mm`, `new Date(...)` parses in the *browser's local*
 * timezone and shifts timeline bars / walk-in clocks by ±offset (often −1 hr
 * adjacent to CET/CEST for EU staff).
 *
 * Canonical forms we accept: trailing `Z`, `+00:00`, `-05:30`, `+0530`.
 */
export function instantFromApi(input: string | Date): Date {
  if (typeof input !== "string") return input;
  const s = input.trim();
  if (!s) return new Date(Number.NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00.000Z`);
  const iso = s.includes("T") ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return new Date(s);
  if (/z$/i.test(iso)) return new Date(iso);
  if (/[+-]\d{2}:\d{2}$/.test(iso)) return new Date(iso);
  if (/[+-]\d{4}$/.test(iso)) return new Date(iso);
  if (/[+-]\d{2}$/.test(iso)) return new Date(iso);
  return new Date(`${iso}Z`);
}

function parseTemporalInput(input: string | Date): Date {
  return instantFromApi(input);
}

export function formatDate(input: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = parseTemporalInput(input);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(date);
}

/** Interpret instants using the tenant IANA zone (API stores UTC ISO strings). */
export function formatDateInTz(input: string | Date, timeZone: string): string {
  const date = parseTemporalInput(input);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatTimeInTz(input: string | Date, timeZone: string): string {
  const date = parseTemporalInput(input);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

/** WhatsApp-style relative label for chat/conversation list rows. */
export function formatChatListTime(input: string | Date, timeZone: string): string {
  const date = parseTemporalInput(input);
  const ymdInTz = (instant: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);

  const today = ymdInTz(new Date());
  const messageDay = ymdInTz(date);

  if (messageDay === today) {
    return formatTimeInTz(date, timeZone);
  }

  if (messageDay === shiftCalendarDaysYmd(today, -1, timeZone)) {
    return "Yesterday";
  }

  const dayDiff = Math.round(
    (Date.parse(`${today}T12:00:00.000Z`) - Date.parse(`${messageDay}T12:00:00.000Z`)) /
      86_400_000,
  );
  if (dayDiff > 0 && dayDiff < 7) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone,
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone,
  }).format(date);
}

/** Long label for a calendar YYYY-MM-DD string in tenant TZ (avoid browser-local drift). */
export function formatCalendarYmdLabel(ymd: string, timeZone: string): string {
  const [yy, mm, dd] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const anchorUtc =
    Number.isFinite(yy) && mm && dd ? Date.UTC(yy, mm - 1, dd, 12, 0, 0) : Date.now();
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(anchorUtc));
}

export function formatTime(input: string) {
  const t = input.trim();
  // Only shorthand "HH:mm" / "HH:mm:ss"; never mis-read ISO prefixes.
  const hm = /^(\d{2}:\d{2})(?::\d{2})?$/.exec(t);
  if (
    hm &&
    !t.includes("T") &&
    !t.includes("Z") &&
    !t.includes("+") &&
    t.length <= 8
  ) {
    return hm[1] ?? "";
  }
  const d = new Date(input);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function todayISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Today YYYY-MM-DD for a tenant IANA zone — use for reservation date pickers. */
export function todayISOInTz(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Add whole calendar days (no DST in SE Asia; anchored at noon UTC to reduce edge quirks). */
export function shiftCalendarDaysYmd(
  ymd: string,
  deltaDays: number,
  timeZone: string,
): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const anchorUtc =
    Number.isFinite(y) && m && d ? Date.UTC(y, m - 1, d, 12, 0, 0) : Date.UTC(1970, 0, 1, 12);
  const nextUtc = anchorUtc + deltaDays * 86_400_000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nextUtc));
}

/** Wall-clock minutes since local midnight (`timeZone`). `sv-SE` + explicit 24h avoids `formatToParts` quirks with some `en-*` locales. */
function tenantZonedMinutesSinceMidnight(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const label = dtf.format(instant);
  const hm = /^(\d{1,2}):(\d{2})$/.exec(label);
  if (hm) return Number.parseInt(hm[1], 10) * 60 + Number.parseInt(hm[2], 10);
  const parts = dtf.formatToParts(instant);
  const n = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return n("hour") * 60 + n("minute");
}

/** Tenant-local elapsed minutes since `startHour:00` (for timeline stripes). */
export function tenantZonedElapsedMinutes(
  instant: Date,
  timeZone: string,
  startHour: number,
): number {
  return tenantZonedMinutesSinceMidnight(instant, timeZone) - startHour * 60;
}

export function initials(name?: string | null) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

/** English ordinal suffix: 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Format integer minor units (cents) into a localized currency string. */
export function formatMoney(cents: number, currency = "IDR"): string {
  const amount = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Spa/wellness services store whole currency units in `price_cents` (e.g. 350000
 * = Rp 350,000). Unlike ticketing, no ÷100 conversion is applied.
 */
export function formatServicePrice(amount: number, currency = "IDR"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toLocaleString()}`;
  }
}

export function statusLabel(status: string, spa = false) {
  // Spa/wellness: a "seated" appointment means the room/therapist is in use.
  if (spa && status === "seated") return "In use";
  switch (status) {
    case "no_show":
      return "No-show";
    case "waitlisted":
      return "Waitlisted";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function statusClass(status: string) {
  // map to .pill.<class> defined in globals.css
  if (status === "no_show") return "noshow";
  return status;
}

/** Label for public/guest display: "T7 · Indoor" or comma-joined for combinations. */
export function formatGuestAssignedTables(
  tables: { name: string; section?: string | null }[] | undefined,
): string | null {
  if (!tables?.length) return null;
  return tables
    .map((t) => (t.section ? `${t.name} · ${t.section}` : t.name))
    .join(", ");
}
