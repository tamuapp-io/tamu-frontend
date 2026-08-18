"use client";

import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Paid capabilities for the active venue, as computed by the server.
 *
 * Advisory only — this hides locked UI so staff don't hit a 403. The real gate
 * is the `feature:` middleware on the API.
 */
export function useFeatures(): string[] {
  return useAuthStore((s) => s.tenant?.features) ?? [];
}

export function useHasFeature(slug: string): boolean {
  const features = useFeatures();
  return features.includes(slug);
}
