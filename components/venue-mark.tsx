"use client";

import { useState } from "react";

/**
 * A venue's logo, or its name as text when there isn't one.
 *
 * The single place that decision is made, so every guest-facing surface —
 * booking page, payment page, manage page — agrees on what a venue looks like.
 *
 * The image is a plain <img> on purpose. `logo_url` is an arbitrary URL a venue
 * owner uploaded or pasted, so its hostname can't be listed in next.config's
 * images.remotePatterns ahead of time, and next/image throws "hostname is not
 * configured" at runtime for anything not on that list.
 */
export function VenueMark({
  name,
  logoUrl,
  logoClassName = "max-h-24 w-auto max-w-[280px] object-contain",
  fallback,
}: {
  name?: string | null;
  logoUrl?: string | null;
  logoClassName?: string;
  /** Rendered instead of the logo when there is none, or when it fails to load. */
  fallback?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name ?? "Venue"}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={logoClassName}
      />
    );
  }

  // Also the path when the logo 404s — a broken image must never leave the
  // header empty, least of all on the page where someone is about to pay.
  if (fallback !== undefined) return <>{fallback}</>;

  return name ? (
    <span className="text-2xl font-semibold tracking-tight">{name}</span>
  ) : null;
}
