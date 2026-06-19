"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, MapPin, Plus, QrCode, Ticket } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { useCreateEvent, useEventsList } from "@/lib/hooks/use-events";
import { formatDate, formatTime } from "@/lib/format";
import type { EventModel, EventStatus } from "@/lib/types";

const STATUS_TONE: Record<EventStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  completed: "bg-amber-100 text-amber-900",
};

export default function EventsPage() {
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const list = useEventsList({ q: q.trim() || undefined });
  const rows = list.data?.data ?? [];

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Operate" }, { label: "Events", current: true }]}
        primaryAction={{ label: "New event", onClick: () => setCreateOpen(true) }}
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-sm"
            placeholder="Search events by name or venue…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Link
            href="/events/check-in"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            <QrCode className="h-4 w-4" /> Check-in scanner
          </Link>
          {list.isFetching && (
            <span className="text-xs text-muted-foreground">Refreshing…</span>
          )}
        </div>

        {list.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}
        {list.isError && (
          <p className="text-sm text-destructive">
            {list.error instanceof ApiError ? list.error.message : "Failed to load events."}
          </p>
        )}
        {!list.isPending && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Ticket className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No events yet. Create your first event to start selling tickets.
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {rows.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      </div>

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function EventRow({ event }: { event: EventModel }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{event.name}</h3>
          <Badge className={STATUS_TONE[event.status]}>{event.status}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {event.starts_at && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
            </span>
          )}
          {event.venue && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {event.venue}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-5 text-right">
        <Stat label="Ticket types" value={event.ticket_types_count ?? 0} />
        <Stat label="Orders" value={event.orders_count ?? 0} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function CreateEventDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const create = useCreateEvent();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [venue, setVenue] = useState("");

  const errs = (create.error instanceof ApiError && create.error.errors) || {};

  async function submit() {
    if (!name.trim() || !startsAt) return;
    try {
      const event = await create.mutateAsync({
        name: name.trim(),
        starts_at: new Date(startsAt).toISOString(),
        venue: venue.trim() || undefined,
      });
      onOpenChange(false);
      setName("");
      setStartsAt("");
      setVenue("");
      router.push(`/events/${event.id}`);
    } catch {
      /* shown inline */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Event name</Label>
            <Input
              id="e-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New Year Gala"
              invalid={!!errs.name}
            />
            {errs.name?.[0] && <p className="text-xs text-destructive">{errs.name[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-start">Starts at</Label>
            <Input
              id="e-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              invalid={!!errs.starts_at}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-venue">Venue (optional)</Label>
            <Input
              id="e-venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Rooftop Garden"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending || !name.trim() || !startsAt}>
            {create.isPending ? "Creating…" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
