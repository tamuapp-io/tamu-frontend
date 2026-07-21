"use client";

import type { ReactNode } from "react";
import { isReturningGuest } from "@/components/returning-guest-badge";
import type { GuestProfile } from "@/lib/types";

/**
 * Shared building blocks for guest-profile panels, so the WhatsApp inbox and
 * the CRM contacts sidebar render an identical detail card.
 */
export function ProfileField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function GuestStats({ guest }: { guest: GuestProfile }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      <ProfileField label="Bookings" value={guest.total_bookings ?? 0} />
      <ProfileField label="Visits" value={guest.visit_count ?? 0} />
      <ProfileField label="No-shows" value={guest.no_show_count ?? 0} />
      <ProfileField
        label="Status"
        value={
          isReturningGuest(guest.total_bookings) ? (
            <span className="font-medium">Returning guest</span>
          ) : (
            <span className="text-muted-foreground">First-time</span>
          )
        }
      />
    </dl>
  );
}
