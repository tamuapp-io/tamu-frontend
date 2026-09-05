"use client";

import { useMemo } from "react";
import { LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reservation, Therapist } from "@/lib/types";
import { useNowTick } from "@/lib/hooks/use-now-tick";
import { useTimelineFollow } from "@/lib/hooks/use-timeline-follow";
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
  /** Pins the now line to a fixed instant; omit to track the live clock. */
  now?: Date;
  onReservationClick?: (reservation: Reservation) => void;
}

// See service-timeline.tsx — an hour column narrow enough to truncate the
// guest's name makes the bar decoration rather than information, and the bars
// are buttons that need a 44px hit target.
const HOUR_COL_WIDTH = 132;
const ROW_HEIGHT = 46;
const ROW_GAP = 8;
const LABEL_WIDTH = 184;

export function SpaServiceTimeline({
  reservations,
  therapists,
  tenantTimeZone,
  resourceLabel = "Therapist",
  startHour = 9,
  endHour = 21,
  now: nowProp,
  onReservationClick,
}: SpaServiceTimelineProps) {
  // Null until mounted (see useNowTick) — the now line simply isn't drawn yet.
  const tick = useNowTick();
  const now = nowProp ?? tick;
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
    if (!now) return null;
    const diff = tenantZonedElapsedMinutes(now, tenantTimeZone, startHour);
    if (diff < 0 || diff > minutesShown) return null;
    return diff * pxPerMinute;
  })();

  const { scrollRef, following, jumpToNow, canFollow, scrollHandlers } = useTimelineFollow(
    nowOffset,
    LABEL_WIDTH,
  );

  if (lanes.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Add {resourceLabel.toLowerCase()}s in Manage to see the schedule timeline.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* One scroller for ruler and lanes together. Two of them (the old shape)
          drift apart the moment either is scrolled, putting every bar under the
          wrong hour label. The row-label column is frozen with `sticky` instead. */}
      <div
        ref={scrollRef}
        {...scrollHandlers}
        tabIndex={0}
        role="region"
        aria-label={`${resourceLabel} schedule timeline`}
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div style={{ width: LABEL_WIDTH + hours * HOUR_COL_WIDTH }}>
          <div className="flex border-b border-border bg-muted/30">
            <div
              className="sticky left-0 z-30 shrink-0 bg-card px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              style={{ width: LABEL_WIDTH }}
            >
              {resourceLabel}
            </div>
            {Array.from({ length: hours }).map((_, i) => {
              const h = startHour + i;
              return (
                <div
                  key={h}
                  className="shrink-0 border-l border-border px-2 py-2.5 text-[12px] font-medium text-muted-foreground tabular-nums"
                  style={{ width: HOUR_COL_WIDTH }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>

          <div className="flex">
            <div
              className="sticky left-0 z-30 shrink-0 border-r border-border bg-card"
              style={{ width: LABEL_WIDTH }}
            >
              {lanes.map((lane) => (
                <div
                  key={lane.id}
                  className="flex items-center gap-2 px-4 text-[13px]"
                  style={{ height: ROW_HEIGHT + ROW_GAP }}
                >
                  <span className="truncate font-medium text-foreground">
                    {lane.therapist?.name ?? "Unassigned"}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="relative shrink-0"
              style={{
                width: hours * HOUR_COL_WIDTH,
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
                  aria-hidden
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
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold leading-none tabular-nums">
                      {formatTimeInTz(start, tenantTimeZone)}
                      <span className="truncate rounded bg-black/10 px-1 text-[10px] font-medium">
                        {serviceName}
                      </span>
                    </span>
                    <span className="truncate text-[12px] leading-none">
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

      {/* Only offered once following is off — otherwise it's a button that does
          nothing, and the timeline is already where it says it will take you. */}
      {canFollow && !following && (
        <button
          type="button"
          onClick={jumpToNow}
          className="absolute bottom-3 right-3 z-40 inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden /> Jump to now
        </button>
      )}
    </div>
  );
}
