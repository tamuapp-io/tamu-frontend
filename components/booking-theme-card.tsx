"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, Lock, Palette } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { fetchSettings, patchSettings } from "@/lib/api/settings";
import { useHasFeature } from "@/lib/hooks/use-features";
import {
  BOOKING_THEMES,
  DEFAULT_BOOKING_THEME,
  type BookingThemeId,
  type BookingThemeMeta,
} from "@/lib/booking-themes/registry";
import { cn } from "@/lib/utils";

/**
 * Picks the look of the venue's public booking page.
 *
 * Saves on selection rather than behind a Save button: there is one value, it
 * is reversible in a click, and the venue will want to open the booking page to
 * judge it — a staged draft would just mean choosing, saving, then looking.
 */
export function BookingThemeCard({ slug }: { slug?: string | null }) {
  const qc = useQueryClient();
  const hasVenueMap = useHasFeature("venue_map");

  const settings = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => fetchSettings().then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (theme: BookingThemeId) => patchSettings({ booking: { theme } }),
    onSuccess: (_res, theme) => {
      const meta = BOOKING_THEMES.find((t) => t.id === theme);
      toast.success(`Booking page set to ${meta?.name ?? theme}`);
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
    },
    onError: (e) =>
      toast.error(
        "Could not change the booking page theme",
        e instanceof ApiError ? e.message : undefined,
      ),
  });

  if (settings.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  const booking = (settings.data?.settings?.booking ?? {}) as Record<string, unknown>;
  const stored = typeof booking.theme === "string" ? booking.theme : null;
  // An id saved before a theme was retired should not leave every card
  // unselected — the page falls back to the default, so this says so too.
  const current: string =
    BOOKING_THEMES.some((t) => t.id === stored) && stored ? stored : DEFAULT_BOOKING_THEME;

  function available(theme: BookingThemeMeta) {
    return theme.requires !== "venue_map" || hasVenueMap;
  }

  // The request is only half the wait: on success the settings query is
  // invalidated and has to come back before `current` agrees. Holding the
  // pending id across both is what stops the card flicking back to the old
  // theme for a frame between the PATCH resolving and the refetch landing.
  //
  // The `current !== save.variables` half is what ends the hold: every other
  // control on this tab invalidates the same query, so keying purely off
  // `isFetching` would replay "Applying Sesi…" the next time someone toggled
  // the waitlist switch, long after the theme was saved.
  const settled = save.isSuccess && current === save.variables;
  const settling = save.isPending || (save.isSuccess && !settled && settings.isFetching);
  const pendingId = settling ? (save.variables ?? null) : null;
  const pendingTheme = BOOKING_THEMES.find((t) => t.id === pendingId) ?? null;

  return (
    <Card className="overflow-hidden shadow-xs">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">Booking page theme</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Announced politely rather than as an alert: it is progress, not a
                problem, and the toast already covers the outcome. */}
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-opacity",
                pendingTheme ? "opacity-100" : "opacity-0",
              )}
            >
              {pendingTheme && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Applying {pendingTheme.name}…
                </>
              )}
            </p>
            {slug && (
            <Link
              href={`/book/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Preview <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          How your booking page looks to guests. The steps and the details you
          collect are the same in every theme.
        </p>
      </div>

      <fieldset className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Booking page theme</legend>

        {BOOKING_THEMES.map((theme) => {
          const saving = pendingId === theme.id;
          // The chosen card lights up on click rather than on the response —
          // a radio that stays unticked while a request runs reads as broken.
          const selected = pendingId ? saving : current === theme.id;
          const locked = !available(theme);
          // A different card is mid-save, so this one is not a target yet.
          const blocked = settling && !saving;

          return (
            <label
              key={theme.id}
              aria-busy={saving}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all",
                selected ? "border-foreground/30 bg-muted/60" : "border-border hover:bg-muted/30",
                locked && "cursor-not-allowed opacity-60 hover:bg-transparent",
                saving && "cursor-progress",
                blocked && "pointer-events-none opacity-50",
              )}
            >
              <input
                type="radio"
                name="booking-theme"
                value={theme.id}
                checked={selected}
                disabled={locked || settling}
                onChange={() => save.mutate(theme.id)}
                className="peer sr-only"
              />

              {/* Ring follows keyboard focus on the visually-hidden radio, so
                  tabbing through the three options is still visible. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-ring ring-offset-2 opacity-0 peer-focus-visible:opacity-100"
              />

              <span aria-hidden className="flex gap-1.5">
                {[theme.swatch.ground, theme.swatch.surface, theme.swatch.accent].map(
                  (hex) => (
                    <span
                      key={hex}
                      className="h-6 w-6 rounded-md border border-black/10"
                      style={{ background: hex }}
                    />
                  ),
                )}
              </span>

              <span className="mt-3 flex items-center gap-2">
                <span className="text-sm font-semibold">{theme.name}</span>
                {saving ? (
                  <Loader2
                    className="h-4 w-4 animate-spin text-muted-foreground"
                    aria-label="Applying"
                  />
                ) : (
                  selected && <Check className="h-4 w-4 text-foreground" aria-label="Selected" />
                )}
                {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
              </span>
              <span className="text-xs text-muted-foreground">{theme.tagline}</span>

              <span className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {theme.description}
              </span>

              {locked && (
                <span className="mt-3 rounded-lg bg-muted px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  Needs the venue map. Switch it on to let guests pick their
                  table from your floor plan.
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
    </Card>
  );
}
