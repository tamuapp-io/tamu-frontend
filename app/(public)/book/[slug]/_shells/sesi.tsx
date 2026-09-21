"use client";

import { VenueMark } from "@/components/venue-mark";
import { Stepper } from "../_steps";
import type { BookingFlow } from "../_use-booking-flow";
import { PoweredByTamu, StaffReturnLink } from "./_chrome";
import { BookingStepsOutlet } from "./_outlet";

/**
 * Sesi — midnight concierge.
 *
 * One centred column on a near-black ground, led by the venue name at display
 * size. Suits venues where the booking is the whole page: a tasting menu, a
 * single seating, a bar with one room.
 */
export function SesiShell({ flow }: { flow: BookingFlow }) {
  const { venue } = flow;

  return (
    <div data-booking-theme="sesi" className="min-h-svh">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
        <header className="mb-10 text-center">
          <div className="mb-8 flex justify-start">
            <StaffReturnLink isSpa={flow.isSpa} />
          </div>

          {venue.logo_url ? (
            <span className="inline-flex rounded-[var(--bk-radius)] bg-white p-3">
              <VenueMark
                name={venue.name}
                logoUrl={venue.logo_url}
                logoClassName="max-h-20 w-auto max-w-[220px] object-contain"
                fallback={
                  <span className="px-1 text-2xl font-semibold tracking-tight text-[#14110d]">
                    {venue.name}
                  </span>
                }
              />
            </span>
          ) : (
            <h1 className="font-[family-name:var(--bk-font-display)] text-5xl leading-[0.98] tracking-tight sm:text-6xl">
              {venue.name}
            </h1>
          )}

          {venue.description && (
            <p className="mx-auto mt-5 max-w-prose text-[15px] leading-relaxed text-[var(--bk-muted)]">
              {venue.description}
            </p>
          )}
          {(venue.address || venue.phone) && (
            <p className="mt-4 text-xs text-[var(--bk-muted)]">
              {venue.address}
              {venue.address && venue.phone ? " · " : ""}
              {venue.phone}
            </p>
          )}
        </header>

        <Stepper
          step={flow.step}
          isSpa={flow.isSpa}
          hasMap={flow.hasMap}
          hasMenu={flow.hasMenu}
          terminology={venue.terminology}
        />
        <BookingStepsOutlet flow={flow} />
        <PoweredByTamu />
      </div>
    </div>
  );
}
