"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, Search } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useEventAttendees, useEventsList } from "@/lib/hooks/use-events";
import { formatDate, formatMoney } from "@/lib/format";
import type { TicketOrder } from "@/lib/types";

const ORDER_STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-900",
  cancelled: "bg-rose-100 text-rose-800",
  refunded: "bg-muted text-muted-foreground",
};

export default function EventAttendeesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [eventId, setEventId] = useState("");

  const events = useEventsList({ per_page: 100 });
  const attendees = useEventAttendees({
    q: q.trim() || undefined,
    status: status || undefined,
    event_id: eventId || undefined,
  });

  const rows = attendees.data?.data ?? [];
  const total = attendees.data?.meta?.total ?? rows.length;

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Event guests", current: true }]}
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search attendees by name, email or phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="h-9 max-w-[220px] rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            <option value="">All events</option>
            {(events.data?.data ?? []).map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
          {attendees.isFetching && (
            <span className="text-xs text-muted-foreground">Refreshing…</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {total} {total === 1 ? "attendee" : "attendees"}
          </span>
        </div>

        {attendees.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {attendees.isError && (
          <p className="text-sm text-destructive">
            {attendees.error instanceof ApiError
              ? attendees.error.message
              : "Failed to load attendees."}
          </p>
        )}
        {!attendees.isPending && rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No event guests yet.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Attendee</th>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium tabular-nums">Tickets</th>
                  <th className="px-4 py-2.5 font-medium tabular-nums">Checked in</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium tabular-nums">Total</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Purchased</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <AttendeeRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function AttendeeRow({ order }: { order: TicketOrder }) {
  const guest = order.guest;
  const source = order.referral?.label ?? order.referral?.code ?? order.source ?? "Direct";

  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium">{guest?.name ?? "Guest"}</p>
        <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {guest?.email && (
            <a href={`mailto:${guest.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Mail className="h-3 w-3" /> {guest.email}
            </a>
          )}
          {guest?.phone && (
            <a href={`tel:${guest.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Phone className="h-3 w-3" /> {guest.phone}
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {order.event ? (
          <Link
            href={`/events/${order.event.id}`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {order.event.name}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 tabular-nums">{order.tickets_count ?? 0}</td>
      <td className="px-4 py-3 tabular-nums">
        {order.checked_in_count ?? 0}
        <span className="text-muted-foreground">/{order.tickets_count ?? 0}</span>
      </td>
      <td className="px-4 py-3 text-xs">{source}</td>
      <td className="px-4 py-3 tabular-nums">
        {order.total_cents === 0 ? "Free" : formatMoney(order.total_cents, order.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge className={ORDER_STATUS_TONE[order.status] ?? "bg-muted text-muted-foreground"}>
          {order.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {order.created_at ? formatDate(order.created_at) : "—"}
      </td>
    </tr>
  );
}
