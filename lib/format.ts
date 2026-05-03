function parseTemporalInput(input: string | Date): Date {
  return typeof input === "string" ? new Date(input) : input;
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
    hourCycle: "h23",
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

/** Tenant-local elapsed minutes since `startHour:00` (for timeline stripes). */
export function tenantZonedElapsedMinutes(
  instant: Date,
  timeZone: string,
  startHour: number,
): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(instant);
  const n = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  const hour = n("hour");
  const minute = n("minute");
  return hour * 60 + minute - startHour * 60;
}

export function initials(name?: string | null) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

export function statusLabel(status: string) {
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
