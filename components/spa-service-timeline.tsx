"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Reservation, Therapist } from "@/lib/types";
import {
  initials,
  statusClass,
  tenantZonedElapsedMinutes,
  formatTimeInTz,
  instantFromApi,
} from "@/lib/format";

interface SpaServiceTimelineProps {
  reservations: Reservation[];
  therapists: Therapist[];
  tenantTimeZone: string;
  /** Label for the row header column (e.g. Therapist / Practitioner). */
  resourceLabel?: string;
  startHour?: number;
  endHour?: number;
  now?: Date;
  onReservationClick?: (reservation: Reservation) => void;
}

const HOUR_COL_WIDTH = 64;
const ROW_HEIGHT = 40;
const ROW_GAP = 6;

export function SpaServiceTimeline({
  reservations,
  therapists,
  tenantTimeZone,
  resourceLabel = "Therapist",
  startHour = 9,
  endHour = 21,
  now = new Date(),
  onReservationClick,
}: SpaServiceTimelineProps) {
  const hours = endHour - startHour;
  const minutesShown = hours * 60;
  const pxPerMinute = HOUR_COL_WIDTH / 60;

  const lanes = useMemo(() => {
    const activeTherapists = therapists
      .filter((t) => t.is_active)
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

    const byLane = new Map<string, { therapist?: Therapist; items: Reservation[] }>();

    for (const t of activeTherapists) {
      byLane.set(t.id, { therapist: t, items: [] });
    }

    for (const r of reservations) {
      const id = r.therapist_id ?? r.therapist?.id ?? "unassigned";
      if (!byLane.has(id)) {
        byLane.set(id, { therapist: undefined, items: [] });
      }
      byLane.get(id)!.items.push(r);
    }

    return Array.from(byLane.entries())
      .map(([id, lane]) => ({
        id,
        therapist: lane.therapist,
        items: lane.items.sort(
          (a, b) =>
            instantFromApi(a.reserved_at).getTime() - instantFromApi(b.reserved_at).getTime(),
        ),
      }))
      .sort((a, b) => {
        if (a.id === "unassigned") return 1;
        if (b.id === "unassigned") return -1;
        if (!a.therapist || !b.therapist) return 0;
        return (
          a.therapist.display_order - b.therapist.display_order ||
          a.therapist.name.localeCompare(b.therapist.name)
        );
      });
  }, [reservations, therapists]);

  const offsetFor = (date: Date) => {
    const diff = tenantZonedElapsedMinutes(date, tenantTimeZone, startHour);
    return Math.max(0, diff * pxPerMinute);
  };

  const widthFor = (mins: number) => Math.max(32, mins * pxPerMinute - 4);

  const nowOffset = (() => {
    const diff = tenantZonedElapsedMinutes(now, tenantTimeZone, startHour);
    if (diff < 0 || diff > minutesShown) return null;
    return diff * pxPerMinute;
  })();

  if (lanes.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Add {resourceLabel.toLowerCase()}s in Manage to see the schedule timeline.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="grid grid-cols-[160px_1fr] border-b border-border bg-muted/30">
        <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {resourceLabel}
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
                  className="border-l border-border px-2 py-2 text-[11px] font-medium text-muted-foreground tabular-nums first:border-l-0"
                  style={{ width: HOUR_COL_WIDTH }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[160px_1fr]">
        <div className="border-r border-border bg-muted/10">
          {lanes.map((lane) => (
            <div
              key={lane.id}
              className="flex items-center gap-2 px-4 text-[12px]"
              style={{ height: ROW_HEIGHT + ROW_GAP }}
            >
              <span className="font-medium text-foreground">
                {lane.therapist?.name ?? "Unassigned"}
              </span>
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
            {Array.from({ length: hours }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-border first:border-l-0"
                style={{ left: i * HOUR_COL_WIDTH, width: HOUR_COL_WIDTH }}
                aria-hidden
              />
            ))}

            {nowOffset !== null && (
              <div
                className="absolute top-0 bottom-0 z-10 w-px bg-rose-500"
                style={{ left: nowOffset }}
                aria-label="Current time"
              >
                <span className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full bg-rose-500" />
              </div>
            )}

            {lanes.map((lane, laneIdx) =>
              lane.items.map((r) => {
                const start = instantFromApi(r.reserved_at);
                const left = offsetFor(start);
                const width = widthFor(r.duration_mins);
                const serviceName = r.service?.name ?? "Treatment";

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
                    title={`${r.guest?.name ?? "Guest"} · ${serviceName} · ${formatTimeInTz(
                      start,
                      tenantTimeZone,
                    )}${r.room?.name ? ` · ${r.room.name}` : ""}`}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-semibold leading-none tabular-nums">
                      {formatTimeInTz(start, tenantTimeZone)}
                      <span className="truncate rounded bg-black/10 px-1 text-[10px] font-medium">
                        {serviceName}
                      </span>
                    </span>
                    <span className="truncate text-[11px] leading-none">
                      {r.guest?.name ?? "Guest"}
                      {r.room?.name ? (
                        <span className="text-[10px] opacity-75"> · {r.room.name}</span>
                      ) : null}
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
