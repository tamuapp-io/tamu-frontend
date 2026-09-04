"use client";

import { useState } from "react";
import { TamuLogo } from "@/components/tamu-brand";
import { safeBrandColor } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { PublicReservationVenue } from "@/lib/types";

/**
 * The guest-facing frame for pages reached from a confirmation link: the venue
 * leads, Tamu signs the footer. Extracted so /pay and /manage cannot drift
 * apart — they are two halves of one moment, and a guest who pays under one
 * identity and lands under another has reason to doubt both.
 */
export function PublicVenueShell({
  venue,
  className,
  children,
}: {
  venue?: PublicReservationVenue | null;
  className?: string;
  children: React.ReactNode;
}) {
  const brand = safeBrandColor(venue?.brand_color);

  return (
    <div
      className={cn("mx-auto max-w-xl p-4 pt-10 sm:p-8", className)}
      // Consumed only by accent rules — never as a ground behind text, since an
      // arbitrary venue colour can't be contrast-checked ahead of time.
      style={brand ? ({ "--venue-brand": brand } as React.CSSProperties) : undefined}
    >
      <header className="mb-6 flex flex-col items-center gap-3 text-center">
        <VenueMark venue={venue} />
        {brand && (
          <span
            aria-hidden
            className="h-0.5 w-10 rounded-full"
            style={{ background: "var(--venue-brand)" }}
          />
        )}
      </header>

      {children}

      <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground">
        <TamuLogo height={12} className="opacity-70" />
        <span>Bookings powered by Tamu</span>
      </footer>
    </div>
  );
}

/**
 * A venue's logo_url is an arbitrary URL its owner pasted into settings, so the
 * hostname can't be enumerated in next.config's images.remotePatterns —
 * next/image would throw "hostname is not configured" at runtime. A plain <img>
 * is the correct tool for a URL we cannot know in advance.
 */
function VenueMark({ venue }: { venue?: PublicReservationVenue | null }) {
  const [broken, setBroken] = useState(false);
  const name = venue?.name;
  const logo = venue?.logo_url;

  if (logo && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name ?? "Venue"}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="max-h-14 w-auto max-w-[220px] object-contain"
      />
    );
  }

  // Also the path when the logo 404s: a broken image must never leave the
  // header empty on the page where someone is about to pay.
  return name ? (
    <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
  ) : null;
}
