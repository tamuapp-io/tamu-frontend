"use client";

import dynamic from "next/dynamic";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, MapPin } from "lucide-react";
import { TamuLogo } from "@/components/tamu-brand";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { publicEventsApi } from "@/lib/api/public-events";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { Ticket, TicketOrder } from "@/lib/types";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[196px] w-[196px] rounded-lg" />,
  },
);

export default function PublicTicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const query = useQuery({
    queryKey: ["public", "ticket", code],
    queryFn: async () => (await publicEventsApi.ticket(code)).data,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-md p-4 pt-10 sm:p-8">
      {query.isLoading && (
        <>
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="mb-6 h-4 w-72" />
          <Skeleton className="h-80 w-full" />
        </>
      )}

      {query.isError && (
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Ticket not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {query.error instanceof ApiError && query.error.status === 404
              ? "This ticket link is invalid or has expired."
              : "We couldn't load this ticket. Please try again later."}
          </p>
        </Card>
      )}

      {query.data && <OrderTickets order={query.data} highlightCode={code} />}

      <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground">
        <TamuLogo height={12} className="opacity-70" />
        <span>Tickets powered by Tamu</span>
      </footer>
    </div>
  );
}

function OrderTickets({
  order,
  highlightCode,
}: {
  order: TicketOrder;
  highlightCode: string;
}) {
  const event = order.event;
  const tickets = order.tickets ?? [];

  return (
    <>
      <header className="mb-6 text-center">
        <p className="label-cap">Your ticket{tickets.length === 1 ? "" : "s"}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event?.name}</h1>
        <div className="mt-2 flex flex-col items-center gap-1 text-sm text-muted-foreground">
          {event?.starts_at && (
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
          {event?.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {event.venue}
            </span>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            highlight={ticket.code === highlightCode}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Present the QR code at the door for entry. Screenshots work too.
      </p>
    </>
  );
}

function TicketCard({ ticket, highlight }: { ticket: Ticket; highlight: boolean }) {
  const checkedIn = ticket.status === "checked_in";
  const voided = ticket.status === "void" || ticket.status === "refunded";

  return (
    <Card
      className={cn(
        "overflow-hidden p-0",
        highlight && "ring-2 ring-foreground/80",
      )}
    >
      <div className="flex items-center justify-between border-b border-dashed border-border px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {ticket.ticket_type?.name ?? "General admission"}
          </p>
          {ticket.attendee_name && (
            <p className="truncate text-xs text-muted-foreground">{ticket.attendee_name}</p>
          )}
        </div>
        <StatusPill status={ticket.status} />
      </div>

      <div className="flex flex-col items-center px-5 py-6">
        <div
          className={cn(
            "relative rounded-xl border border-border bg-white p-4",
            (checkedIn || voided) && "opacity-40",
          )}
        >
          <QRCodeSVG value={ticket.code} size={196} level="M" marginSize={0} />
          {checkedIn && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" /> Checked in
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground break-all text-center">
          {ticket.code}
        </p>
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: Ticket["status"] }) {
  const map: Record<Ticket["status"], { label: string; cls: string }> = {
    issued: { label: "Valid", cls: "bg-emerald-100 text-emerald-700" },
    checked_in: { label: "Checked in", cls: "bg-sky-100 text-sky-700" },
    void: { label: "Void", cls: "bg-muted text-muted-foreground" },
    refunded: { label: "Refunded", cls: "bg-rose-100 text-rose-700" },
  };
  const v = map[status] ?? map.issued;
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", v.cls)}>
      {v.label}
    </span>
  );
}
