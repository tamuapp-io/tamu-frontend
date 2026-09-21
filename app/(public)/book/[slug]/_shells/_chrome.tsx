"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TamuLogo } from "@/components/tamu-brand";
import { useAuthStore } from "@/lib/store/auth-store";

/**
 * The "back to app" link a staff member sees when they open a venue's public
 * booking page while signed in. Shared by the shells so a new theme cannot
 * silently drop it — without it a staff member has no way back but the browser
 * button, since the public page has no app navigation.
 */
export function StaffReturnLink({
  isSpa,
  className,
}: {
  isSpa?: boolean;
  className?: string;
}) {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated || !token) return null;

  return (
    <Link
      href={isSpa ? "/reservations" : "/live"}
      className={className ?? "inline-flex items-center gap-1.5 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"}
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      Back to app
    </Link>
  );
}

/** Tamu's signature under the venue's. Every theme carries it. */
export function PoweredByTamu({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "mt-10 flex flex-col items-center gap-2 text-center text-[11px] text-[var(--bk-muted)]"
      }
    >
      <TamuLogo height={12} className="opacity-70" />
      <span>Bookings powered by Tamu</span>
    </div>
  );
}
