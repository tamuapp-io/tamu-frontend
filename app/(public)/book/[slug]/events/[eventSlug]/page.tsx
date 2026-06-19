"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, MapPin, Minus, Plus } from "lucide-react";
import { TamuLogo } from "@/components/tamu-brand";
import { PhoneInput } from "@/components/phone-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { publicEventsApi } from "@/lib/api/public-events";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import type {
  EventPageBlock,
  PublicEvent,
  PublicTicketType,
  TicketOrder,
} from "@/lib/types";

export default function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string; eventSlug: string }>;
}) {
  const { slug, eventSlug } = use(params);
  const [ref, setRef] = useState<string | null>(null);
  const [order, setOrder] = useState<TicketOrder | null>(null);

  // Capture ?ref= from the URL and fire a click-tracking beacon once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (code) {
      setRef(code);
      void publicEventsApi.trackReferral(code).catch(() => {});
    }
  }, []);

  const eventQuery = useQuery({
    queryKey: ["public", slug, "event", eventSlug],
    queryFn: async () => (await publicEventsApi.get(slug, eventSlug)).data,
    retry: false,
  });

  if (eventQuery.isLoading) return <EventShellSkeleton />;

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <EventShell event={null}>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Event not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This event isn&apos;t available or hasn&apos;t been published yet.
          </p>
        </Card>
      </EventShell>
    );
  }

  const event = eventQuery.data;

  return (
    <EventShell event={event}>
      {order ? (
        <PurchaseSuccess order={order} />
      ) : (
        <Checkout slug={slug} eventSlug={eventSlug} event={event} referralCode={ref} onDone={setOrder} />
      )}
    </EventShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shell + page-config renderer                                              */
/* -------------------------------------------------------------------------- */

function EventShell({
  event,
  children,
}: {
  event: PublicEvent | null;
  children: React.ReactNode;
}) {
  const primary = event?.page_config?.theme?.primary;
  const cover = event?.page_config?.theme?.cover_image_url;

  return (
    <div
      className="mx-auto max-w-2xl p-4 pt-10 sm:p-8"
      style={primary ? ({ ["--event-primary" as string]: primary } as React.CSSProperties) : undefined}
    >
      {cover && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-48 w-full object-cover" />
        </div>
      )}
      {event && (
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">{event.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {event.starts_at && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(event.starts_at))}
              </span>
            )}
            {event.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.venue}
              </span>
            )}
          </div>
          {event.description && (
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              {event.description}
            </p>
          )}
        </header>
      )}

      {event?.page_config?.blocks?.length ? (
        <div className="mb-6 space-y-5">
          {event.page_config.blocks.map((block, i) => (
            <PageBlock key={i} block={block} />
          ))}
        </div>
      ) : null}

      {children}

      <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground">
        <TamuLogo height={12} className="opacity-70" />
        <span>Tickets powered by Tamu</span>
      </footer>
    </div>
  );
}

function PageBlock({ block }: { block: EventPageBlock }) {
  if (block.type === "hero") {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        {block.heading && <h2 className="text-2xl font-semibold">{block.heading}</h2>}
        {block.body && <p className="mt-2 text-sm text-muted-foreground">{block.body}</p>}
      </section>
    );
  }
  if (block.type === "text") {
    return (
      <section>
        {block.heading && <h3 className="text-base font-semibold">{block.heading}</h3>}
        {block.body && (
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{block.body}</p>
        )}
      </section>
    );
  }
  if (block.type === "image" && block.image_url) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.image_url} alt="" className="w-full object-cover" />
      </div>
    );
  }
  if (block.type === "highlights" && block.items?.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return null;
}

function EventShellSkeleton() {
  return (
    <div className="mx-auto max-w-2xl p-4 pt-10 sm:p-8">
      <Skeleton className="mb-2 h-9 w-64" />
      <Skeleton className="mb-8 h-4 w-80" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Checkout                                                                  */
/* -------------------------------------------------------------------------- */

function Checkout({
  slug,
  eventSlug,
  event,
  referralCode,
  onDone,
}: {
  slug: string;
  eventSlug: string;
  event: PublicEvent;
  referralCode: string | null;
  onDone: (order: TicketOrder) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });

  const purchase = useMutation({
    mutationFn: async () => {
      const items = Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }));
      return (
        await publicEventsApi.purchase(slug, eventSlug, {
          guest: {
            name: guest.name.trim(),
            email: guest.email.trim(),
            phone: guest.phone.trim() || undefined,
          },
          items,
          referral_code: referralCode ?? undefined,
        })
      ).data;
    },
    onSuccess: onDone,
  });

  const total = useMemo(() => {
    return event.ticket_types.reduce(
      (sum, t) => sum + (qty[t.id] ?? 0) * t.price_cents,
      0,
    );
  }, [qty, event.ticket_types]);

  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);
  const currency = event.ticket_types[0]?.currency ?? "IDR";

  const errs = (purchase.error instanceof ApiError && purchase.error.errors) || {};
  const formError =
    purchase.error instanceof ApiError && !purchase.error.errors
      ? purchase.error.message
      : null;

  function setQuantity(type: PublicTicketType, next: number) {
    const clamped = Math.max(0, Math.min(next, type.remaining ?? 999, type.max_per_order));
    setQty((q) => ({ ...q, [type.id]: clamped }));
  }

  const onSale = event.ticket_types.filter((t) => t.on_sale || (t.remaining ?? 1) > 0);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Choose your tickets</h2>
        {onSale.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Tickets aren&apos;t on sale right now.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {event.ticket_types.map((type) => {
            const soldOut = type.remaining === 0;
            const disabled = soldOut || !type.on_sale;
            return (
              <div
                key={type.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{type.name}</p>
                  {type.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{type.description}</p>
                  )}
                  <p className="mt-1 text-sm font-medium">
                    {type.price_cents === 0 ? "Free" : formatMoney(type.price_cents, type.currency)}
                  </p>
                  {soldOut && <p className="mt-1 text-xs text-rose-600">Sold out</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={disabled || (qty[type.id] ?? 0) <= 0}
                    onClick={() => setQuantity(type, (qty[type.id] ?? 0) - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums">{qty[type.id] ?? 0}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={disabled}
                    onClick={() => setQuantity(type, (qty[type.id] ?? 0) + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {totalQty > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Your details</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Full name</Label>
              <Input
                id="b-name"
                value={guest.name}
                onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
                invalid={!!errs["guest.name"]}
              />
              {errs["guest.name"]?.[0] && (
                <p className="text-xs text-destructive">{errs["guest.name"][0]}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="b-email">Email</Label>
                <Input
                  id="b-email"
                  type="email"
                  value={guest.email}
                  onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                  invalid={!!errs["guest.email"]}
                />
                {errs["guest.email"]?.[0] && (
                  <p className="text-xs text-destructive">{errs["guest.email"][0]}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-phone">
                  Phone <span className="text-muted-foreground">(optional — for WhatsApp ticket link)</span>
                </Label>
                <PhoneInput
                  id="b-phone"
                  value={guest.phone}
                  onChange={(next) => setGuest((g) => ({ ...g, phone: next }))}
                  tenantTimezone={event.tenant_timezone}
                  invalid={!!errs["guest.phone"]}
                />
              </div>
            </div>

            {formError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {totalQty} {totalQty === 1 ? "ticket" : "tickets"}
                </p>
                <p className="text-lg font-semibold">
                  {total === 0 ? "Free" : formatMoney(total, currency)}
                </p>
              </div>
              <Button
                disabled={purchase.isPending || !guest.name.trim() || !guest.email.trim()}
                onClick={() => purchase.mutate()}
              >
                {purchase.isPending ? "Processing…" : "Get tickets"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function PurchaseSuccess({ order }: { order: TicketOrder }) {
  const firstCode = order.tickets?.[0]?.code;
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">You&apos;re going!</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ve emailed your {order.tickets?.length ?? 0}{" "}
        {(order.tickets?.length ?? 0) === 1 ? "ticket" : "tickets"} with QR codes for entry.
      </p>

      {firstCode && (
        <Link
          href={`/tickets/${firstCode}`}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-primary-foreground"
        >
          View my tickets
        </Link>
      )}
    </Card>
  );
}
