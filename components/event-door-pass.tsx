"use client";

import dynamic from "next/dynamic";
import { CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeInTz } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicReservationEvent } from "@/lib/types";

// Same lazy import the ticket page uses — the QR library is ~20KB and only a
// booking made for an event ever needs it.
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[176px] w-[176px] rounded-lg" />,
  },
);

/**
 * The door pass for a table booked for an event.
 *
 * A guest who booked a table arrived at the same door as a ticket holder with
 * nothing to show. This is deliberately the same shape as a ticket's QR so the
 * host scans one thing all night, but it encodes a separately-signed token —
 * scanning it seats the booking rather than admitting a ticket.
 */
export function EventDoorPass({
  event,
  timeZone,
  seated = false,
}: {
  event: PublicReservationEvent;
  timeZone: string;
  /** Dims the code once the party is in the room, like a used ticket. */
  seated?: boolean;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/30 px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Your event pass
        </p>
        <p className="mt-0.5 text-sm font-semibold">{event.name}</p>
        {event.starts_at && (
          <p className="text-sm text-muted-foreground">
            {formatTimeInTz(event.starts_at, timeZone)}
            {event.ends_at ? ` – ${formatTimeInTz(event.ends_at, timeZone)}` : null}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center px-5 py-6">
        {/* White ground regardless of theme: a QR on a dark card is unreadable
            to half the scanners in the world. */}
        <div
          className={cn(
            "relative rounded-xl border border-border bg-white p-4",
            seated && "opacity-40",
          )}
        >
          <QRCodeSVG value={event.door_code} size={176} level="M" marginSize={0} />
          {seated && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" /> Checked in
              </span>
            </div>
          )}
        </div>

        <p className="mt-4 max-w-xs text-center text-sm text-muted-foreground">
          {seated
            ? "You're checked in — enjoy your evening."
            : "Show this at the door and we'll take you to your table."}
        </p>
      </div>
    </section>
  );
}
