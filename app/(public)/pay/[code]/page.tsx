"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, Calendar, Check, LayoutGrid, Lock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicVenueShell } from "@/components/public-venue-shell";
import { publicBookingApi } from "@/lib/api/public-booking";
import { useNowTick } from "@/lib/hooks/use-now-tick";
import { formatGuestAssignedTables, formatMoney } from "@/lib/format";
import type { PublicReservation } from "@/lib/types";

/**
 * The guest-facing payment page.
 *
 * Xendit's hosted checkout carries the venue's own branding (set in the venue's
 * Xendit dashboard) and accepts no branding fields over the API, so this page is
 * how the moment of payment stays ours: we own the screen before the handoff and
 * the screen after it, and Xendit owns only the ~30 seconds of entering card or
 * e-wallet details in between.
 *
 * It is also the invoice's `success_redirect_url` AND `failure_redirect_url`, so
 * every one of its states has to make sense as a landing page, not just as a
 * departure point.
 */
export default function PayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const query = useQuery({
    queryKey: ["public", "pay", code],
    queryFn: async () => {
      const res = (await publicBookingApi.show(code)).data;

      // The guest is standing here *because* they just came back from checkout,
      // so this is the likeliest place for a missed webhook to show up as a
      // booking that looks unpaid. Ask the gateway directly.
      if (res.status === "pending" && res.payment?.status === "pending") {
        try {
          return (await publicBookingApi.refreshPayment(code)).data;
        } catch {
          return res; // reconciliation is best-effort
        }
      }
      return res;
    },
    retry: false,
    refetchInterval: (q) => {
      const res = q.state.data;
      return res && res.payment?.status === "pending" ? 3000 : false;
    },
  });

  if (query.isLoading) {
    return (
      <PublicVenueShell>
        <Skeleton className="h-72 w-full" />
      </PublicVenueShell>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PublicVenueShell>
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold">
            We couldn&apos;t find this booking
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The confirmation code may have a typo, or the booking has been removed.
          </p>
        </Card>
      </PublicVenueShell>
    );
  }

  const r = query.data;

  return (
    <PublicVenueShell venue={r.venue}>
      <PaymentCard reservation={r} code={code} />
    </PublicVenueShell>
  );
}

function PaymentCard({
  reservation: r,
  code,
}: {
  reservation: PublicReservation;
  code: string;
}) {
  const payment = r.payment;

  // Nothing to pay — the guest followed a /pay link for a booking that never
  // needed a deposit. Show the booking rather than an empty payment screen.
  if (!payment) {
    return (
      <Card className="p-8 text-center">
        <Check className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">No payment needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This booking is confirmed with nothing left to pay.
        </p>
        <ManageLink code={code} className="mt-6" />
      </Card>
    );
  }

  if (payment.status === "paid") {
    return (
      <Card className="p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-6 w-6 text-emerald-700" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Payment received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatMoney(payment.amount_cents, payment.currency)} paid — your booking is
            confirmed. A confirmation email is on its way.
          </p>
        </div>

        <BookingFacts reservation={r} />
        <OrderSummary reservation={r} paid />

        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-3 text-center text-sm">
          <span className="text-muted-foreground">Confirmation code</span>{" "}
          <span className="font-mono font-medium">{r.confirmation_code}</span>
        </div>

        <ManageLink code={code} className="mt-6" />
      </Card>
    );
  }

  if (payment.status === "expired" || payment.status === "failed") {
    return (
      <Card className="p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
            <AlertTriangle className="h-6 w-6 text-rose-700" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            This payment link has expired
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The table was released so someone else could book it. You&apos;re welcome to
            book again — nothing was charged.
          </p>
        </div>
        <ManageLink code={code} className="mt-6" label="View booking" />
      </Card>
    );
  }

  // Pending, but no hosted invoice to send them to. Rare (invoice creation
  // failed after the reservation was written), and a dead button would be worse
  // than an honest dead end.
  if (!payment.invoice_url) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">We couldn&apos;t start the payment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your booking is held under code{" "}
          <span className="font-mono font-medium">{r.confirmation_code}</span>. Please
          contact the venue to complete it.
        </p>
        <ManageLink code={code} className="mt-6" label="View booking" />
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">Complete your booking</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your table is held until payment is received.
      </p>

      <BookingFacts reservation={r} />
      <OrderSummary reservation={r} />

      <div className="mt-6 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm font-medium">Total due now</span>
        <span className="num text-2xl font-semibold">
          {formatMoney(payment.amount_cents, payment.currency)}
        </span>
      </div>

      <Countdown expiresAt={payment.expires_at} timezone={r.restaurant_timezone} />

      <a
        href={payment.invoice_url}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Lock className="h-4 w-4" aria-hidden />
        Pay {formatMoney(payment.amount_cents, payment.currency)}
      </a>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        You&apos;ll finish on Xendit&apos;s secure checkout, then come straight back here.
      </p>
    </Card>
  );
}

/** When / who / where — the booking this payment is for. */
function BookingFacts({ reservation: r }: { reservation: PublicReservation }) {
  const tz = r.restaurant_timezone ?? "UTC";
  const isSpa = !!r.service;
  const tablesLabel = formatGuestAssignedTables(r.assigned_tables);

  return (
    <dl className="mt-6 grid grid-cols-[92px_1fr] gap-y-2.5 border-t border-border pt-5 text-sm">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" aria-hidden /> When
      </dt>
      <dd className="font-medium">
        {new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        }).format(new Date(r.reserved_at))}
      </dd>

      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden /> {isSpa ? "Treatment" : "Party"}
      </dt>
      <dd className="font-medium">
        {isSpa
          ? r.service?.name ?? "—"
          : `${r.party_size} ${r.party_size === 1 ? "guest" : "guests"}`}
      </dd>

      {!isSpa && tablesLabel ? (
        <>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Table
          </dt>
          <dd className="font-medium">{tablesLabel}</dd>
        </>
      ) : null}
    </dl>
  );
}

/**
 * What the total is made of. Since pre-ordered food and the deposit go onto one
 * invoice, an un-itemised total reads as an overcharge — the guest has no way to
 * tell a deposit from a deposit plus two plates of food.
 */
function OrderSummary({
  reservation: r,
  paid = false,
}: {
  reservation: PublicReservation;
  paid?: boolean;
}) {
  const lines = r.menu_order_items ?? [];
  const currency = r.payment?.currency ?? "IDR";
  const hasDeposit = !!r.deposit_cents;

  if (lines.length === 0 && !hasDeposit) return null;

  return (
    <div className="mt-5 border-t border-border pt-5">
      <h2 className="label-cap">
        {paid ? "What you paid for" : "What you're paying for"}
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        {lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-3">
            <span>
              <span className="text-muted-foreground">{line.quantity}×</span>{" "}
              {line.name}
            </span>
            <span className="num shrink-0 tabular-nums">
              {formatMoney(line.line_total_cents, currency)}
            </span>
          </li>
        ))}
        {hasDeposit && (
          <li className="flex items-baseline justify-between gap-3">
            <span>Booking deposit</span>
            <span className="num shrink-0 tabular-nums">
              {formatMoney(r.deposit_cents!, currency)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Time left on the hosted invoice.
 *
 * The ticking digits are aria-hidden with a static sentence beside them: a live
 * region that re-announces every second is unusable with a screen reader, and
 * the exact expiry time is the part that's actually actionable.
 */
function Countdown({
  expiresAt,
  timezone,
}: {
  expiresAt?: string | null;
  timezone?: string;
}) {
  const now = useNowTick(1000);
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;

  // `now` is null until mounted (the server has no meaningful clock), so the
  // first paint shows the expiry time without a countdown rather than flashing
  // a wrong one.
  const remainingMs = now ? expiry.getTime() - now.getTime() : null;

  const at = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? "UTC",
  }).format(expiry);

  if (remainingMs !== null && remainingMs <= 0) {
    return (
      <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-900">
        This payment link has expired.
      </p>
    );
  }

  return (
    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
      {remainingMs !== null && (
        <span aria-hidden className="num font-medium tabular-nums">
          {formatRemaining(remainingMs)}
        </span>
      )}{" "}
      <span>Payment link expires at {at}.</span>
    </p>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${String(mins).padStart(2, "0")}m left ·`;
  return `${mins}:${String(secs).padStart(2, "0")} left ·`;
}

function ManageLink({
  code,
  className,
  label = "Manage booking",
}: {
  code: string;
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href={`/manage/${encodeURIComponent(code)}`}
      className={`flex h-11 w-full items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted ${className ?? ""}`}
    >
      {label}
    </Link>
  );
}
