"use client";

import { VenueMark } from "@/components/venue-mark";
import { Stepper } from "../_steps";
import type { BookingFlow } from "../_use-booking-flow";
import { PoweredByTamu, StaffReturnLink } from "./_chrome";
import { BookingStepsOutlet } from "./_outlet";
import { BookingSummary } from "./_summary";

/**
 * Sajian — warm editorial.
 *
 * A dark venue panel holds identity and the running summary while the guest
 * works down the steps beside it. On phones the panel stops being a column and
 * becomes the page header, so the same markup reads top-to-bottom.
 */
export function SajianShell({ flow }: { flow: BookingFlow }) {
  const { venue } = flow;

  return (
    <div
      data-booking-theme="sajian"
      className="min-h-svh lg:grid lg:grid-cols-[minmax(340px,26rem)_1fr]"
    >
      <aside className="flex flex-col gap-8 bg-[var(--bk-panel)] px-6 py-8 text-[var(--bk-panel-text)] sm:px-10 lg:sticky lg:top-0 lg:h-svh lg:py-12">
        <StaffReturnLink isSpa={flow.isSpa} />

        <div>
          {/* An uploaded logo is an arbitrary image — often dark artwork on a
              transparent background, which would disappear against this panel.
              It gets a light tile; the text fallback does not need one. */}
          {venue.logo_url ? (
            <span className="inline-flex rounded-[var(--bk-radius)] bg-white p-3">
              <VenueMark
                name={venue.name}
                logoUrl={venue.logo_url}
                logoClassName="max-h-20 w-auto max-w-[220px] object-contain"
                fallback={
                  <span className="px-1 text-2xl font-semibold tracking-tight text-[#1f1611]">
                    {venue.name}
                  </span>
                }
              />
            </span>
          ) : (
            <h1 className="font-[family-name:var(--bk-font-display)] text-4xl leading-[1.05] tracking-tight">
              {venue.name}
            </h1>
          )}

          {venue.description && (
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--bk-panel-muted)]">
              {venue.description}
            </p>
          )}
          {(venue.address || venue.phone) && (
            <p className="mt-3 text-xs text-[var(--bk-panel-muted)]">
              {venue.address}
              {venue.address && venue.phone ? " · " : ""}
              {venue.phone}
            </p>
          )}
        </div>

        {/* Pushed to the foot of the column on desktop; sits directly under the
            venue on phones, where there is no column to push against. */}
        <div className="border-t border-white/10 pt-6 lg:mt-auto">
          <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-[var(--bk-panel-muted)]">
            Your table
          </p>
          <BookingSummary flow={flow} />
        </div>
      </aside>

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 lg:py-12">
        <Stepper
          step={flow.step}
          isSpa={flow.isSpa}
          hasMap={flow.hasMap}
          hasMenu={flow.hasMenu}
          terminology={venue.terminology}
        />
        <BookingStepsOutlet flow={flow} />
        <PoweredByTamu />
      </main>
    </div>
  );
}
