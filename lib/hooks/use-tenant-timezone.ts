"use client";

import { useAuthStore } from "@/lib/store/auth-store";

/** IANA zone for the logged-in tenant (stored times are UTC; display filters use this). */
export function useTenantTimezone(): string {
  return useAuthStore((s) => s.tenant?.timezone ?? "UTC");
}
