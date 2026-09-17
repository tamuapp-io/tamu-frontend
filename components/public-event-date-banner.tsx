"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatTimeInTz } from "@/lib/format";
import type { PublicUpcomingEvent } from "@/lib/types";

/** At most this many banners before collapsing the rest into a count. */
const MAX_SHOWN = 2;

/**
 * "There's something on that night."
 *
 * Renders nothing unless the chosen date has a published event, so it costs an
 * empty fragment on every ordinary day. The data rides along on the booking
 * profile the page already loaded, which is why picking a date shows this
 * instantly rather than after a request.
 *
 * The match is a string comparison against `local_dates`, expanded server-side
 * in the venue's timezone. Deriving the date from `starts_at` here would mean
 * guessing a timezone in the browser, and a 31 Dec 23:00 WIB event would
 * announce itself on the 30th.
 */
export function PublicEventDateBanner({
  slug,
  events,
  date,
  timeZone,
}: {
  slug: string;
  events: PublicUpcomingEvent[];
  /** The `YYYY-MM-DD` currently in the date field. */
  date: string;
  timeZone: string;
}) {
  const matches = date ? events.filter((e) => e.local_dates?.includes(date)) : [];

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 space-y-3">
      {matches.slice(0, MAX_SHOWN).map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-4 rounded-lg border border-border bg-muted/30 p-4"
        >
          {event.cover_image_url ? (
            // Plain <img>: next.config.js has no images.remotePatterns, and an
            // arbitrary uploaded hostname can't be listed there ahead of time.
            // Same reasoning as components/venue-mark.tsx.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.cover_image_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-16 w-16 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Happening on this date
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">{event.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatTimeInTz(event.starts_at, timeZone)}
              {event.ends_at ? ` – ${formatTimeInTz(event.ends_at, timeZone)}` : null}
            </p>
            <Link
              href={`/book/${slug}/events/${event.slug}`}
              className="mt-1.5 inline-block text-sm font-medium underline underline-offset-4"
            >
              View event &amp; tickets
            </Link>
          </div>
        </div>
      ))}

      {matches.length > MAX_SHOWN && (
        <p className="text-xs text-muted-foreground">
          {`+ ${matches.length - MAX_SHOWN} more on this date`}
        </p>
      )}
    </div>
  );
}
