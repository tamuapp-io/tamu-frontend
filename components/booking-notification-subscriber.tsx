"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { reservationsApi } from "@/lib/api/reservations";
import { notifyStaffNewBooking } from "@/lib/booking-notifications";
import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Polls for newly created reservations so booking alerts (sound, toast, badge)
 * work even when Reverb is unavailable or misconfigured.
 */
export function BookingNotificationSubscriber() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ["booking-notification-poll"],
    enabled: hydrated && !!token,
    refetchInterval: 15_000,
    queryFn: async () =>
      reservationsApi
        .list({ per_page: 20, sort: "-created_at" })
        .then((response) => response.data),
  });

  useEffect(() => {
    const rows = data;
    if (!rows?.length) {
      if (rows && !initializedRef.current) {
        initializedRef.current = true;
      }
      return;
    }

    if (!initializedRef.current) {
      for (const row of rows) {
        knownIdsRef.current.add(row.id);
      }
      initializedRef.current = true;
      return;
    }

    for (const row of rows) {
      if (knownIdsRef.current.has(row.id)) {
        continue;
      }

      knownIdsRef.current.add(row.id);
      notifyStaffNewBooking({
        reservation: {
          id: row.id,
          source: row.source,
          guest: row.guest ? { name: row.guest.name } : undefined,
          party_size: row.party_size,
        },
      });
      break;
    }
  }, [data]);

  return null;
}
