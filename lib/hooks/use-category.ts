"use client";

import { useAuthStore } from "@/lib/store/auth-store";
import type { CategoryTerminology } from "@/lib/types";

const FALLBACK: Required<CategoryTerminology> = {
  reservation: "Reservation",
  reservations: "Reservations",
  resource: "Table",
  resources: "Tables",
  party: "Party size",
  book_cta: "Book",
  book_intro: "",
};

/**
 * The active tenant's category + category-aware terminology, so pages can
 * relabel ("Reservations" → "Appointments", "Table" → "Room") without
 * duplicating the registry on the client.
 */
export function useCategory() {
  const tenant = useAuthStore((s) => s.tenant);
  const config = tenant?.category_config;
  const terminology = config?.terminology ?? {};

  const term = (key: keyof CategoryTerminology, fallback?: string): string =>
    terminology[key] ?? fallback ?? FALLBACK[key];

  return {
    category: tenant?.category ?? "restaurant",
    isSpa: config?.booking_strategy === "spa",
    usesPartySize: config?.uses_party_size ?? true,
    terminology,
    term,
  };
}
