"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Reservation, Table } from "@/lib/types";
import { initials, statusClass, tenantZonedElapsedMinutes, formatTimeInTz } from "@/lib/format";

interface ServiceTimelineProps {
  reservations: Reservation[];
  tables: Table[];
  /** IANA TZ for slot labels + horizontal positioning (stored times are UTC). */
  tenantTimeZone: string;
  /** Hours shown — defaults to 11:00–23:00 */
  startHour?: number;
  endHour?: number;
  /** Highlight current time line (defaults to now) */
  now?: Date;
  onReservationClick?: (reservation: Reservation) => void;
}

const HOUR_COL_WIDTH = 64;
const ROW_HEIGHT = 36;
const ROW_GAP = 6;

export function ServiceTimeline({
  reservations,
  tables,
  tenantTimeZone,
  startHour = 11,
  endHour = 23,
  now = new Date(),
  onReservationClick,
}: ServiceTimelineProps) {
  const hours = endHour - startHour;
  const minutesShown = hours * 60;
  const pxPerMinute = HOUR_COL_WIDTH / 60;

  // Group reservations by table id (or "unassigned" key)
  const lanes = useMemo(() => {
    const tableMap = new Map<string, Table>();
    for (const t of tables) tableMap.set(t.id, t);

    const byLane = new Map<string, { table?: Table; items: Reservation[] }>();
    for (const r of reservations) {
      const id = r.table_id ?? r.tables?.[0]?.id ?? "unassigned";
      if (!byLane.has(id)) {
        byLane.set(id, { table: tableMap.get(id), items: [] });
      }
      byLane.get(id)!.items.push(r);
    }

    return Array.from(byLane.entries())
      .map(([id, lane]) => ({
        id,
        table: lane.table,
        items: lane.items.sort(
          (a, b) =>
            new Date(a.reserved_at).getTime() - new Date(b.reserved_at).getTime(),
        ),
      }))
      .sort((a, b) => {
        if (!a.table && !b.table) return 0;
        if (!a.table) return 1;
        if (!b.table) return -1;
        return (a.table.priority ?? 0) - (b.table.priority ?? 0);
      });
  }, [reservations, tables]);

  // Convert reservation start to px offset from startHour in tenant TZ
  const offsetFor = (date: Date) => {
    const diff = tenantZonedElapsedMinutes(date, tenantTimeZone, startHour);
    return Math.max(0, diff * pxPerMinute);
  };

  const widthFor = (mins: number) =>
    Math.max(28, mins * pxPerMinute - 4);

  const nowOffset = (() => {
    const diff = tenantZonedElapsedMinutes(now, tenantTimeZone, startHour);
    if (diff < 0 || diff > minutesShown) return null;
    return diff * pxPerMinute;
  })();

  if (lanes.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        No reservations on the timeline yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* Hour ruler */}
      <div className="grid grid-cols-[140px_1fr] border-b border-border bg-muted/30">
        <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Table
        </div>
        <div className="overflow-x-auto">
          <div
            className="flex"
            style={{ width: hours * HOUR_COL_WIDTH, minWidth: hours * HOUR_COL_WIDTH }}
          >
            {Array.from({ length: hours }).map((_, i) => {
              const h = startHour + i;
              return (
                <div
                  key={h}
                  className="border-l border-border first:border-l-0 px-2 py-2 text-[11px] font-medium text-muted-foreground tabular-nums"
                  style={{ width: HOUR_COL_WIDTH }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[140px_1fr]">
        <div className="border-r border-border bg-muted/10">
          {lanes.map((lane) => (
            <div
              key={lane.id}
              className="flex items-center gap-2 px-4 text-[12px]"
              style={{ height: ROW_HEIGHT + ROW_GAP }}
            >
              <span className="font-medium text-foreground">
                {lane.table?.name ?? "Unassigned"}
              </span>
              {lane.table?.section && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {lane.table.section}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div
            className="relative"
            style={{
              width: hours * HOUR_COL_WIDTH,
              minWidth: hours * HOUR_COL_WIDTH,
              height: lanes.length * (ROW_HEIGHT + ROW_GAP),
            }}
          >
            {/* Hour grid columns */}
            {Array.from({ length: hours }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-border first:border-l-0"
                style={{ left: i * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                aria-hidden
              />
            ))}

            {/* Now line */}
            {nowOffset !== null && (
              <div
                className="absolute top-0 bottom-0 z-10 w-px bg-rose-500"
                style={{ left: nowOffset }}
                aria-label="Current time"
              >
                <span className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full bg-rose-500" />
              </div>
            )}

            {/* Reservation bars */}
            {lanes.map((lane, laneIdx) =>
              lane.items.map((r) => {
                const start = new Date(r.reserved_at);
                const left = offsetFor(start);
                const width = widthFor(r.duration_mins);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onReservationClick?.(r)}
                    className={cn(
                      "absolute flex flex-col justify-center gap-0.5 overflow-hidden rounded-md border px-2 py-1 text-left transition-shadow hover:shadow-md",
                      "pill",
                      statusClass(r.status),
                    )}
                    style={{
                      top: laneIdx * (ROW_HEIGHT + ROW_GAP) + ROW_GAP / 2,
                      left,
                      width,
                      height: ROW_HEIGHT,
                      borderRadius: 8,
                    }}
                    title={`${r.guest?.name ?? "Walk-in"} · party ${r.party_size} · ${formatTimeInTz(
                      start,
                      tenantTimeZone,
                    )}`}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-semibold leading-none tabular-nums">
                      {formatTimeInTz(start, tenantTimeZone)}
                      <span className="rounded bg-black/10 px-1 text-[10px] font-medium">
                        {r.party_size}
                      </span>
                    </span>
                    <span className="truncate text-[11px] leading-none">
                      {r.guest?.name ??
                        (r.source === "walkin"
                          ? "Walk-in"
                          : `Party of ${r.party_size}`)}
                    </span>
                    <span className="sr-only">{initials(r.guest?.name)}</span>
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
