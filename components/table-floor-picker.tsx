"use client";

/**
 * TableFloorPicker
 * ----------------
 * Floor-plan-style selector used when seating a walk-in or moving a
 * reservation to a different table. The visual vocabulary matches
 * `FloorPlanPreview` so staff aren't context-switching between two
 * different floor renderings.
 *
 * Conflict math runs entirely client-side over the day's reservation list
 * already cached by TanStack Query. The backend still enforces correctness
 * via the Redis slot lock + the partial unique index on
 * `(table_id, reserved_at) WHERE status != 'cancelled'` — this picker is
 * advisory UI, never the source of truth.
 */

import { useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { floorLayoutCells } from "@/components/floor-plan-preview";
import { useReservationsList } from "@/lib/hooks/use-reservations";
import { useTablesList } from "@/lib/hooks/use-tables";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { instantFromApi, todayISOInTz } from "@/lib/format";
import type { Table } from "@/lib/types";

const CANVAS_PAD = 48;

export type TableFloorPickerState =
  | "available"
  | "busy"
  | "unfit"
  | "inactive"
  | "selected"
  | "current";

interface TableFloorPickerProps {
  /** Target slot start, ISO 8601 UTC (what we'd send as reservations.reserved_at). */
  reservedAt: string;
  /** Stay/turn duration in minutes — used to compute overlap with other reservations. */
  durationMins: number;
  /** Party size. Tables with min/max capacity outside this range are marked `unfit`. */
  partySize: number;
  /** Currently selected table id (controlled). `null`/`undefined` means "no selection". */
  value: string | null | undefined;
  /** Receives the picked table id, or `null` if the user clears the selection. */
  onChange: (tableId: string | null) => void;
  /** Reservation id to skip when computing busy-set (so a "move-table" picker doesn't
   *  flag the reservation's current assignment as a conflict against itself). */
  excludeReservationId?: string;
  /** Skip flagging a specific table as busy (e.g., the reservation's existing table
   *  is allowed to remain its own current assignment — but we usually exclude
   *  via reservation id rather than table id). Optional escape hatch. */
  excludeTableId?: string;
  /** When set, the matching table renders as the reservation's "current" assignment:
   *  it remains visible for spatial context but is not clickable (selecting it would
   *  be a no-op move). Used by MoveTableDialog. */
  currentTableId?: string;
  /** Override the day fetched for conflict math; defaults to reservedAt-in-tenant-TZ. */
  dateOverride?: string;
  /** Restrict the floor plan to one section. `null`/`"all"`/undefined shows every table. */
  section?: string | null;
}

export function TableFloorPicker({
  reservedAt,
  durationMins,
  partySize,
  value,
  onChange,
  excludeReservationId,
  excludeTableId,
  currentTableId,
  dateOverride,
  section,
}: TableFloorPickerProps) {
  const tz = useTenantTimezone();
  const targetStart = useMemo(() => instantFromApi(reservedAt), [reservedAt]);
  const targetEnd = useMemo(
    () => new Date(targetStart.getTime() + durationMins * 60_000),
    [targetStart, durationMins],
  );

  // YMD for the API filter — must be in tenant TZ so the backend's day-window
  // math matches what the staff see.
  const date = useMemo(() => {
    if (dateOverride) return dateOverride;
    // todayISOInTz is "today" in the zone; we want "reservedAt's day in the zone".
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(targetStart);
  }, [dateOverride, tz, targetStart]);

  const tablesQuery = useTablesList({});
  const reservationsQuery = useReservationsList({ date, per_page: 200 });

  // Anything currently held by an active reservation (pending/confirmed/seated)
  // is considered busy. Cancelled/completed/no-show free the table by definition.
  const busyTableIds = useMemo(() => {
    const out = new Set<string>();
    const rows = reservationsQuery.data?.data ?? [];
    for (const r of rows) {
      if (r.id === excludeReservationId) continue;
      if (r.status === "cancelled" || r.status === "completed" || r.status === "no_show") {
        continue;
      }
      // Waitlist entries don't hold tables — skip explicitly.
      if (r.status === "waitlisted") continue;

      const rStart = instantFromApi(r.reserved_at).getTime();
      const rEnd = rStart + (r.duration_mins ?? 90) * 60_000;
      const overlap = rStart < targetEnd.getTime() && rEnd > targetStart.getTime();
      if (!overlap) continue;

      if (r.table_id) out.add(r.table_id);
      if (r.tables?.length) {
        for (const t of r.tables) out.add(t.id);
      }
    }
    if (excludeTableId) out.delete(excludeTableId);
    return out;
  }, [
    reservationsQuery.data,
    targetStart,
    targetEnd,
    excludeReservationId,
    excludeTableId,
  ]);

  // One floor plan per section: when a section is chosen, only its tables lay
  // out on the canvas (mirrors the sectioned floor plan on Live/Tables).
  const tables: Table[] = useMemo(() => {
    const all = tablesQuery.data ?? [];
    if (!section || section === "all") return all;
    return all.filter((t) => (t.section ?? "").trim() === section);
  }, [tablesQuery.data, section]);

  const layoutCells = useMemo(() => floorLayoutCells(tables), [tables]);

  // Auto-clear the selection if the chosen table becomes ineligible (party
  // size grew, slot moved, etc.) — keeps the form state consistent.
  useEffect(() => {
    if (!value) return;
    const picked = tables.find((t) => t.id === value);
    if (!picked) return;
    const state = pickerState({
      table: picked,
      partySize,
      busy: busyTableIds.has(picked.id),
      selectedId: value,
      currentId: currentTableId,
    });
    if (state !== "selected" && state !== "available") {
      onChange(null);
    }
    // We intentionally omit `onChange` from deps — it's stable from the
    // parent's perspective, and including it can cause loops when the
    // parent recreates the handler each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, partySize, busyTableIds, tables, currentTableId]);

  const dims = useMemo(() => {
    if (layoutCells.length === 0) return { width: 400, height: 280 };
    let r = CANVAS_PAD;
    let b = CANVAS_PAD;
    for (const c of layoutCells) {
      r = Math.max(r, c.x + c.w + CANVAS_PAD);
      b = Math.max(b, c.y + c.h + CANVAS_PAD);
    }
    return { width: Math.max(400, r), height: Math.max(240, b) };
  }, [layoutCells]);

  const loading = tablesQuery.isPending || reservationsQuery.isPending;

  if (tables.length === 0 && !loading) {
    const scoped = section && section !== "all";
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center text-xs text-muted-foreground">
        {scoped
          ? `No tables in ${section}. Pick another section or add tables to it in Tables.`
          : "No tables yet — add some in Tables before seating guests here."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FloorPickerLegend />
      <div
        data-table-floor-picker
        className="relative overflow-auto rounded-lg border border-border bg-muted/25"
        style={{ maxHeight: "min(60vh, 480px)" }}
      >
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/50 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="relative" style={{ width: dims.width, height: dims.height }}>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
              `,
              backgroundSize: "24px 24px",
            }}
          />
          {layoutCells.map((cell) => {
            const busy = busyTableIds.has(cell.table.id);
            const state = pickerState({
              table: cell.table,
              partySize,
              busy,
              selectedId: value,
              currentId: currentTableId,
            });
            const interactive = state === "available" || state === "selected";
            return (
              <button
                key={cell.table.id}
                type="button"
                disabled={!interactive}
                onClick={() => {
                  if (!interactive) return;
                  onChange(state === "selected" ? null : cell.table.id);
                }}
                aria-label={`${cell.table.name} · ${describeState(state, cell.table, partySize)}`}
                aria-pressed={state === "selected"}
                title={describeState(state, cell.table, partySize)}
                className={cn(
                  "absolute flex select-none flex-col items-center justify-center gap-0.5 border-2 px-1 text-center text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  cell.table.shape === "round" ? "rounded-full" : "rounded-lg",
                  interactive && "cursor-pointer hover:scale-[1.03] hover:shadow-md",
                  !interactive && "cursor-not-allowed",
                  pickerStateBg(state),
                  pickerStateBorder(state),
                  pickerStateText(state),
                )}
                style={{
                  left: 0,
                  top: 0,
                  width: cell.w,
                  height: cell.h,
                  transform: `translate(${cell.x}px, ${cell.y}px) rotate(${cell.rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight md:text-xs">
                  {cell.table.name}
                </span>
                <span className="text-[9px] tabular-nums opacity-75">
                  {cell.table.min_capacity}–{cell.table.max_capacity}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function pickerState({
  table,
  partySize,
  busy,
  selectedId,
  currentId,
}: {
  table: Table;
  partySize: number;
  busy: boolean;
  selectedId: string | null | undefined;
  currentId?: string | null;
}): TableFloorPickerState {
  if (selectedId === table.id) return "selected";
  // Current assignment beats other classifications so staff always see
  // where the reservation is right now, even if that table technically
  // shows up as "busy" with this same reservation.
  if (currentId && currentId === table.id) return "current";
  if (table.status !== "active") return "inactive";
  if (busy) return "busy";
  if (partySize < table.min_capacity || partySize > table.max_capacity) return "unfit";
  return "available";
}

function describeState(
  state: TableFloorPickerState,
  table: Table,
  partySize: number,
): string {
  switch (state) {
    case "selected":
      return `${table.name} selected`;
    case "current":
      return `Currently assigned to this reservation`;
    case "available":
      return `Available — fits ${table.min_capacity}–${table.max_capacity}`;
    case "busy":
      return `Booked at this time`;
    case "unfit":
      return `Doesn't fit party of ${partySize} (seats ${table.min_capacity}–${table.max_capacity})`;
    case "inactive":
      return `${table.status === "maintenance" ? "Under maintenance" : "Inactive"}`;
  }
}

function pickerStateBg(state: TableFloorPickerState): string {
  switch (state) {
    case "selected":
      return "bg-accent";
    case "current":
      return "bg-secondary";
    case "available":
      return "bg-card";
    case "busy":
      return "bg-destructive/10";
    case "unfit":
      return "bg-muted/60";
    case "inactive":
      return "bg-muted";
  }
}

function pickerStateBorder(state: TableFloorPickerState): string {
  switch (state) {
    case "selected":
      return "border-foreground shadow-md ring-2 ring-accent/40";
    case "current":
      return "border-foreground/60 border-dashed";
    case "available":
      return "border-border";
    case "busy":
      return "border-destructive/50";
    case "unfit":
      return "border-dashed border-muted-foreground/40";
    case "inactive":
      return "border-muted-foreground/30";
  }
}

function pickerStateText(state: TableFloorPickerState): string {
  switch (state) {
    case "selected":
      return "text-accent-foreground";
    case "current":
      return "text-foreground";
    case "busy":
      return "text-destructive";
    case "unfit":
      return "text-muted-foreground/70";
    case "inactive":
      return "text-muted-foreground";
    default:
      return "";
  }
}

function FloorPickerLegend() {
  const items: Array<{ label: string; state: TableFloorPickerState }> = [
    { label: "Available", state: "available" },
    { label: "Selected", state: "selected" },
    { label: "Current", state: "current" },
    { label: "Booked", state: "busy" },
    { label: "Doesn't fit", state: "unfit" },
    { label: "Inactive", state: "inactive" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-sm border",
              pickerStateBg(i.state),
              pickerStateBorder(i.state),
            )}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// re-export for convenience if callers want to filter their own lists
export { todayISOInTz };
