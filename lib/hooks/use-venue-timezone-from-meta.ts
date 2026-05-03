"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth-store";

/** Merge canonical IANA zone from list endpoints so UI never sticks on stale Asia/Jakarta in localStorage. */
export function useVenueTimezoneFromMeta(canonical?: string | null): void {
  useEffect(() => {
    const z = canonical?.trim();
    if (!z) return;
    const cur = useAuthStore.getState().tenant?.timezone?.trim();
    if (cur === z) return;
    useAuthStore.getState().mergeTenant({ timezone: z });
  }, [canonical]);
}
