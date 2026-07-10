"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Reservation, SpaRoom } from "@/lib/types";
import { formatTimeInTz, instantFromApi, statusClass } from "@/lib/format";

interface SpaRoomsBoardProps {
  rooms: SpaRoom[];
  reservations: Reservation[];
  tenantTimeZone: string;
  onReservationClick?: (reservation: Reservation) => void;
}

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "seated"]);

export function SpaRoomsBoard({
  rooms,
  reservations,
  tenantTimeZone,
  onReservationClick,
}: SpaRoomsBoardProps) {
  const activeRooms = useMemo(
    () => [...rooms].filter((r) => r.is_active).sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)),
    [rooms],
  );

  const byRoom = useMemo(() => {
    const map = new Map<string, Reservation>();
    const now = Date.now();

    for (const r of reservations) {
      if (!r.room_id && !r.room?.id) continue;
      if (!ACTIVE_STATUSES.has(r.status)) continue;

      const roomId = r.room_id ?? r.room?.id;
      if (!roomId) continue;

      const start = instantFromApi(r.reserved_at).getTime();
      const end = start + r.duration_mins * 60_000;
      if (now >= start && now <= end) {
        map.set(roomId, r);
      } else if (!map.has(roomId) && start > now) {
        map.set(roomId, r);
      }
    }

    return map;
  }, [reservations]);

  if (activeRooms.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Add treatment rooms to see room status here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Treatment rooms
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {activeRooms.map((room) => {
          const booking = byRoom.get(room.id);
          const inUse =
            !!booking &&
            booking.status === "seated" &&
            (() => {
              const start = instantFromApi(booking.reserved_at).getTime();
              const end = start + booking.duration_mins * 60_000;
              const now = Date.now();
              return now >= start && now <= end;
            })();

          return (
            <button
              key={room.id}
              type="button"
              disabled={!booking}
              onClick={() => booking && onReservationClick?.(booking)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                inUse
                  ? "border-amber-200 bg-amber-50/80 hover:bg-amber-50"
                  : "border-border bg-muted/20 hover:bg-muted/30",
                !booking && "cursor-default",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{room.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    inUse ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800",
                  )}
                >
                  {inUse ? "In use" : "Free"}
                </span>
              </div>
              {booking ? (
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {booking.guest?.name ?? "Guest"}
                  </p>
                  <p>{booking.service?.name ?? "Treatment"}</p>
                  <p className="tabular-nums">
                    {formatTimeInTz(booking.reserved_at, tenantTimeZone)} ·{" "}
                    {booking.duration_mins} min
                  </p>
                  {booking.therapist?.name && <p>with {booking.therapist.name}</p>}
                  <span className={cn("pill mt-2 inline-flex text-[10px]", statusClass(booking.status))}>
                    {booking.status.replace("_", " ")}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No upcoming booking</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
