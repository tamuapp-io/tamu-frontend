/**
 * The guest-facing looks a venue can choose for its booking page.
 *
 * Data only — no React, no component references — so the Settings screen can
 * list the themes without pulling in the booking page's component tree. The
 * layout shell for each id lives beside the page, in
 * `app/(public)/book/[slug]/_shells/`, and the design tokens in
 * `app/booking-themes.css`.
 *
 * Adding a theme takes four edits, and the id must match in all of them:
 *   1. this file          — the entry below
 *   2. booking-themes.css — a `[data-booking-theme="<id>"]` token block
 *   3. _shells/index.ts   — the component to render
 *   4. config/booking.php — the backend allow-list (`booking.themes`)
 * Miss (4) and the id cannot be saved; miss (1) and a saved id falls back here.
 */

export const BOOKING_THEME_IDS = ["sajian", "atlas", "sesi"] as const;

export type BookingThemeId = (typeof BOOKING_THEME_IDS)[number];

export const DEFAULT_BOOKING_THEME: BookingThemeId = "sajian";

/** A capability a theme cannot render without. */
export type BookingThemeRequirement = "venue_map";

export interface BookingThemeMeta {
  id: BookingThemeId;
  name: string;
  /** One line under the name on the Settings card. */
  tagline: string;
  /** What the guest actually sees, for the Settings card body. */
  description: string;
  /** Preview swatches for the Settings card: ground, surface, accent. */
  swatch: { ground: string; surface: string; accent: string };
  /**
   * Missing capability = the theme is offered but cannot be chosen, and a
   * venue that already had it selected renders the default shell instead.
   */
  requires?: BookingThemeRequirement;
}

export const BOOKING_THEMES: readonly BookingThemeMeta[] = [
  {
    id: "sajian",
    name: "Sajian",
    tagline: "Warm editorial",
    description:
      "A two-column page: the venue and the running booking summary stay pinned on the left while the guest works down date, time and details on the right. Collapses to a single column with a sticky action bar on phones.",
    swatch: { ground: "#F4ECDE", surface: "#FFFFFF", accent: "#A3553B" },
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "Full-screen floor plan",
    description:
      "The venue floor plan fills the screen while every step — including picking a spot — stays in the panel beside it, so guests can tap the plan or the list. Needs the venue map switched on; on phones the panel becomes a bottom sheet.",
    swatch: { ground: "#E9E7E0", surface: "#FFFFFF", accent: "#15594B" },
    requires: "venue_map",
  },
  {
    id: "sesi",
    name: "Sesi",
    tagline: "Midnight concierge",
    description:
      "A dark, centred single column with a large serif headline and one wide search bar for date, time and party size. Suits tasting menus and single-seating venues where the booking is the whole page.",
    swatch: { ground: "#0E0C0A", surface: "#16130F", accent: "#D9B36C" },
  },
] as const;

export function bookingTheme(id: string | null | undefined): BookingThemeMeta {
  return (
    BOOKING_THEMES.find((t) => t.id === id) ??
    BOOKING_THEMES.find((t) => t.id === DEFAULT_BOOKING_THEME)!
  );
}

/**
 * The theme to actually render, given what the venue has switched on.
 *
 * A venue can keep `atlas` selected while its venue map is temporarily off —
 * turning the map back on should restore the look it chose, so the stored id is
 * left alone and only the rendering falls back.
 */
export function resolveBookingTheme(
  id: string | null | undefined,
  capabilities: { hasMap: boolean },
): BookingThemeMeta {
  const chosen = bookingTheme(id);
  if (chosen.requires === "venue_map" && !capabilities.hasMap) {
    return bookingTheme(DEFAULT_BOOKING_THEME);
  }
  return chosen;
}
