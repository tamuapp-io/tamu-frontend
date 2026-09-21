"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { publicBookingApi } from "@/lib/api/public-booking";
import { resolveBookingTheme } from "@/lib/booking-themes/registry";
import type { PublicTenant } from "@/lib/types";
import { BookingShellSkeleton } from "./_steps";
import { useBookingFlow } from "./_use-booking-flow";
import { BOOKING_SHELLS } from "./_shells";

/**
 * The public booking page.
 *
 * Three moving parts, deliberately separated: `useBookingFlow` owns what
 * happens, `_steps` owns what each step looks like, and the shell in `_shells`
 * owns where it all sits. The venue's chosen theme only picks the third — so a
 * theme can never change the order of the flow or the fields collected.
 */
export default function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const profileQuery = useQuery({
    queryKey: ["public", slug, "profile"],
    queryFn: async () => (await publicBookingApi.profile(slug)).data,
    retry: false,
  });

  if (profileQuery.isLoading || !profileQuery.data) {
    if (profileQuery.isError) {
      const err = profileQuery.error;
      return (
        <div data-booking-theme="sajian" className="min-h-svh">
          <div className="mx-auto max-w-2xl p-4 pt-10 sm:p-8">
            <Card className="p-8 text-center">
              <h1 className="text-xl font-semibold">Booking page not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {err instanceof ApiError && err.status === 404
                  ? "This venue hasn't published their booking page yet."
                  : "We couldn't load this booking page. Please try again later."}
              </p>
            </Card>
          </div>
        </div>
      );
    }
    return <BookingShellSkeleton />;
  }

  return <PublicBookingFlow slug={slug} venue={profileQuery.data} />;
}

function PublicBookingFlow({ slug, venue }: { slug: string; venue: PublicTenant }) {
  const flow = useBookingFlow(slug, venue);

  // The stored id is honoured only as far as this venue can render it — Atlas
  // without a venue map would be a full-screen blank. The venue keeps its
  // choice either way, so switching the map back on restores the look.
  const theme = resolveBookingTheme(venue.booking_theme, { hasMap: flow.hasMap });
  const Shell = BOOKING_SHELLS[theme.id];

  return <Shell flow={flow} />;
}
