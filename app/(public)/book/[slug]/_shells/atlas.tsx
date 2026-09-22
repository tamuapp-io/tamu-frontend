"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VenueMapCanvas, type VenueMapArea } from "@/components/venue-map-canvas";
import { VenueMark } from "@/components/venue-mark";
import { publicVenueMapApi } from "@/lib/api/venue-map";
import { useMapAssetUrl } from "@/lib/hooks/use-map-asset";
import { cn } from "@/lib/utils";
import { Stepper } from "../_steps";
import type { BookingFlow } from "../_use-booking-flow";
import { PoweredByTamu, StaffReturnLink } from "./_chrome";
import { BookingStepsOutlet, MAP_STEPS } from "./_outlet";

/**
 * The floor plan as scenery, for the steps that come before it.
 *
 * Shares the query key the area step uses, so this costs no extra request and
 * the map does not blink when the guest arrives at the area step and the same
 * artwork becomes interactive.
 */
function AtlasBackdrop({
  slug,
  venueName,
  reservedAt,
}: {
  slug: string;
  venueName: string;
  /** Kept in the key so this shares the area step's cache entry rather than
   *  fetching the same map a second time under a different instant. */
  reservedAt: string | null;
}) {
  const query = useQuery({
    queryKey: ["public", slug, "venue-map", reservedAt ?? null],
    queryFn: async () => (await publicVenueMapApi.overview(slug, reservedAt)).data,
  });

  const sections = useMemo(() => query.data?.sections ?? [], [query.data]);
  const venueMap = query.data?.map ?? null;
  const { url: mapUrl } = useMapAssetUrl(venueMap?.url ?? null, venueMap?.direct_url);

  const areas: VenueMapArea[] = useMemo(
    () =>
      sections
        .filter((sec) => sec.polygon && sec.polygon.length >= 3)
        .map((sec) => ({
          id: sec.id,
          label: sec.name,
          sublabel: null,
          points: sec.polygon!,
        })),
    [sections],
  );

  if (!venueMap || !mapUrl) {
    // No uploaded artwork, or it failed to load. The area step has its own card
    // grid for this case; here there is simply nothing to draw, and an error
    // banner over a decorative backdrop would alarm a guest about nothing.
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="max-w-sm text-sm text-[var(--bk-muted)]">
          Choose a date and time, then pick where you&apos;d like to sit at{" "}
          {venueName}.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Decorative until the area step: no `onSelectArea`, so nothing here is
          focusable and the keyboard path stays inside the panel. */}
      <div aria-hidden className="h-full [&_*]:cursor-default">
        <VenueMapCanvas
          asset={{ ...venueMap, url: mapUrl }}
          hotspots={[]}
          areas={areas}
          selectedId={null}
        />
      </div>
      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--bk-surface)]/90 px-4 py-2 text-xs text-[var(--bk-muted)] shadow-[var(--bk-shadow)]">
        Pick your table on the plan once you&apos;ve chosen a time
      </p>
    </div>
  );
}

/**
 * Atlas — full-screen floor plan.
 *
 * The venue's plan owns the screen and the booking panel floats over it: a
 * fixed column on desktop, a bottom sheet on phones. The panel is where every
 * step happens, this theme included — on the area and spot steps only the
 * PLAN is lifted out of the step's card and onto the big canvas, while its
 * heading, spot list, prices and Back/Continue stay in the panel with all the
 * other steps. Guests can work from either: tapping the plan and tapping the
 * list drive the same selection.
 *
 * Only rendered for venues with the venue map feature; `resolveBookingTheme`
 * sends everyone else to the default shell.
 */
export function AtlasShell({ flow }: { flow: BookingFlow }) {
  const { venue } = flow;
  const onMapStep = (MAP_STEPS as readonly string[]).includes(flow.step);

  // State, not a ref: the area and spot steps portal their floor plan into this
  // element, and a ref alone would not re-render once it exists.
  const [planEl, setPlanEl] = useState<HTMLDivElement | null>(null);

  // On the two map steps the panel's controls are useless until the plan they
  // point at is on screen, and rendering them one frame early would flash the
  // canvas inside the 26rem panel before the portal moved it.
  const panelReady = !onMapStep || planEl !== null;

  return (
    <div
      data-booking-theme="atlas"
      className="relative flex h-svh flex-col overflow-hidden lg:block"
    >
      {/* The plan. Inset on desktop so the floating panel never covers it. */}
      <div
        ref={setPlanEl}
        className={cn(
          "min-h-0 shrink-0 overflow-y-auto lg:absolute lg:inset-0 lg:pl-[29rem]",
          onMapStep ? "h-[46svh] p-3 sm:p-4 lg:h-auto lg:p-6" : "h-[38svh] lg:h-auto",
        )}
      >
        {/* Nothing of ours during the map steps: the step portals its canvas in
            here, and a backdrop underneath it would be a second copy of the
            same plan. */}
        {onMapStep ? null : <AtlasBackdrop
            slug={flow.slug}
            venueName={venue.name}
            reservedAt={flow.state.slot?.reserved_at_utc ?? null}
          />}
      </div>

      <aside
        className={cn(
          "z-10 flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-[var(--bk-border)] bg-[var(--bk-surface)]",
          "rounded-t-[var(--bk-radius-lg)] shadow-[var(--bk-shadow)]",
          "lg:absolute lg:inset-y-6 lg:left-6 lg:w-[26rem] lg:flex-none lg:rounded-[var(--bk-radius-lg)] lg:border",
        )}
      >
        {/* The sheet's grab handle. Decorative — the sheet does not drag; it is
            a scroll container, and pretending otherwise invites a gesture that
            does nothing. */}
        <span
          aria-hidden
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--bk-border)] lg:hidden"
        />

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <VenueMark
              name={venue.name}
              logoUrl={venue.logo_url}
              logoClassName="max-h-10 w-auto max-w-[160px] object-contain"
              fallback={
                <span className="font-[family-name:var(--bk-font-display)] text-xl font-bold tracking-tight">
                  {venue.name}
                </span>
              }
            />
            <StaffReturnLink isSpa={flow.isSpa} />
          </div>

          <Stepper
            step={flow.step}
            isSpa={flow.isSpa}
            hasMap={flow.hasMap}
            hasMenu={flow.hasMenu}
            terminology={venue.terminology}
          />

          {panelReady && <BookingStepsOutlet flow={flow} mapPortal={planEl} />}

          <PoweredByTamu className="mt-2 flex flex-col items-center gap-2 text-center text-[11px] text-[var(--bk-muted)]" />
        </div>
      </aside>
    </div>
  );
}
