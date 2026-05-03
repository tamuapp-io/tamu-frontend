"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { todayISOInTz } from "@/lib/format";

/**
 * After login/session rehydrate, Zustand can briefly expose timezone as UTC.
 * That seeds the ledger with UTC "today" while the API uses the real tenant TZ.
 * When the server echoes the canonical zone and the tenant-local calendar differs
 * from UTC's, jump forward/back to venue-local today.
 */
export function useUtcBootstrapDateRepair(
  serverTimeZone: string | null | undefined,
  setDate: Dispatch<SetStateAction<string>>,
): void {
  useEffect(() => {
    const z = serverTimeZone?.trim();
    if (!z) return;

    const utcToday = todayISOInTz("UTC");
    const venueToday = todayISOInTz(z);

    setDate((d) => {
      if (d === utcToday && venueToday !== utcToday) {
        return venueToday;
      }
      return d;
    });
  }, [serverTimeZone, setDate]);
}
