"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GuestWhatsappButton } from "@/components/guest-whatsapp-button";
import {
  guestBookingLabel,
  isReturningGuest,
  ReturningGuestBadge,
} from "@/components/returning-guest-badge";
import { ApiError } from "@/lib/api/client";
import { fetchGuests, updateGuestBlacklist } from "@/lib/api/guests";
import type { GuestProfile } from "@/lib/types";

export default function GuestsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const debounced = useMemo(() => q.trim(), [q]);

  const list = useQuery({
    queryKey: ["guests", debounced],
    queryFn: async () =>
      fetchGuests({ q: debounced || undefined, per_page: 50 }).then((r) => ({
        rows: r.data,
        meta: r.meta,
      })),
  });

  const blacklist = useMutation({
    mutationFn: ({
      id,
      is_blacklisted,
    }: {
      id: string;
      is_blacklisted: boolean;
    }) => updateGuestBlacklist(id, { is_blacklisted }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["guests"], exact: false }),
  });

  const rows = list.data?.rows ?? [];

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Guests", current: true }]}
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-sm"
            placeholder="Search name, email, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {list.isFetching && (
            <span className="text-xs text-muted-foreground">Refreshing…</span>
          )}
        </div>

        {list.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {list.isError && (
          <p className="text-sm text-destructive">
            {list.error instanceof ApiError
              ? list.error.message
              : "Failed to load guests."}
          </p>
        )}
        {!list.isPending && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No guests matched.</p>
        )}
        {!list.isPending &&
          rows.map((guest) => (
            <GuestRow
              key={guest.id}
              guest={guest}
              busy={blacklist.isPending}
              onToggle={(next) =>
                blacklist.mutate({ id: guest.id, is_blacklisted: next })
              }
            />
          ))}
      </div>
    </>
  );
}

function GuestRow({
  guest,
  busy,
  onToggle,
}: {
  guest: GuestProfile;
  busy: boolean;
  onToggle: (blacklisted: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-medium">{guest.name}</div>
          <ReturningGuestBadge totalBookings={guest.total_bookings} />
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {[guest.email, guest.phone].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span>{guestBookingLabel(guest.total_bookings)}</span>
          {isReturningGuest(guest.total_bookings) ? (
            <span className="font-medium text-foreground">Returning guest</span>
          ) : null}
          <span>Visits {(guest.visit_count ?? 0) as number}</span>
          <span>No-show {(guest.no_show_count ?? 0) as number}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {guest.is_blacklisted ? (
          <Badge variant="warning">Blacklist</Badge>
        ) : null}
        <GuestWhatsappButton
          phone={guest.phone}
          guestId={guest.id}
          name={guest.name}
        />
        <Button
          type="button"
          size="sm"
          variant={guest.is_blacklisted ? "outline" : "destructive"}
          disabled={busy}
          onClick={() => onToggle(!guest.is_blacklisted)}
        >
          {guest.is_blacklisted ? "Unblock" : "Blacklist"}
        </Button>
      </div>
    </div>
  );
}
