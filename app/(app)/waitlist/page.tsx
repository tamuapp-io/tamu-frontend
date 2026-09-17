"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import {
  fetchWaitlistForDate,
  promoteWaitlistEntry,
  removeWaitlistEntry,
} from "@/lib/api/waitlist-staff";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import type { WaitlistEntryPublic } from "@/lib/types";
import { PromoteWaitlistDialog } from "@/components/promote-waitlist-dialog";

/** A waitlist row as this page renders it. */
type WaitlistRow = WaitlistEntryPublic & { position: number };
import { todayISOInTz, formatDateInTz, formatTimeInTz } from "@/lib/format";

export default function WaitlistStaffPage() {
  const qc = useQueryClient();
  const tz = useTenantTimezone();
  const [date, setDate] = useState(() => todayISOInTz(tz));
  const [promotedCode, setPromotedCode] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["staff-waitlist", date],
    queryFn: async () =>
      fetchWaitlistForDate(date).then((r) => ({ rows: r.data })),
  });

  // Where to seat them. Empty = let the engine choose, which is what this
  // always did; a picked group now reaches the API, which has accepted
  // combination_id all along without any UI ever sending it.
  const [promoting, setPromoting] = useState<WaitlistRow | null>(null);

  const promote = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { table_id?: string | null; combination_id?: string | null };
    }) => promoteWaitlistEntry(id, body),
    onSuccess: (res) => {
      setPromotedCode(res.data.confirmation_code);
      setPromoting(null);
      qc.invalidateQueries({ queryKey: ["staff-waitlist"], exact: false });
      qc.invalidateQueries({ queryKey: ["reservations"], exact: false });
    },
  });

  const remove = useMutation({
    mutationFn: removeWaitlistEntry,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["staff-waitlist"], exact: false }),
  });

  const rows = list.data?.rows ?? [];

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Operate" }, { label: "Waitlist", current: true }]}
      />
      <div className="space-y-4 p-6">
        <Input
          className="max-w-[200px]"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {promotedCode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
            <span>
              New reservation confirmation code{" "}
              <span className="font-mono font-semibold">{promotedCode}</span>
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => setPromotedCode(null)}>
              Dismiss
            </Button>
          </div>
        )}
        {list.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {list.isError && (
          <p className="text-sm text-destructive">
            {list.error instanceof ApiError ? list.error.message : "Failed to load"}
          </p>
        )}
        {!list.isPending && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody waiting.</p>
        )}
        {!list.isPending &&
          rows.map((row, i) => (
            <WaitlistRowView
              key={row.id}
              row={{ ...row, position: typeof row.position === "number" ? row.position : i + 1 }}
              timeZone={tz}
              busy={promote.isPending || remove.isPending}
              onPromote={(row) => setPromoting(row)}
              onRemove={(id) => remove.mutate(id)}
            />
          ))}
      </div>
      <PromoteWaitlistDialog
        row={promoting}
        timeZone={tz}
        open={promoting !== null}
        onOpenChange={(open) => !open && setPromoting(null)}
        pending={promote.isPending}
        onConfirm={(body) => promoting && promote.mutate({ id: promoting.id, body })}
      />

    </>
  );
}

function WaitlistRowView({
  row,
  timeZone,
  busy,
  onPromote,
  onRemove,
}: {
  row: WaitlistEntryPublic & { position: number };
  timeZone: string;
  busy: boolean;
  onPromote: (row: WaitlistRow) => void;
  onRemove: (id: string) => void;
}) {
  const guestBits = row.guest
    ? `${row.guest.name ?? "?"} · ${[
        row.guest.email ?? "",
        row.guest.phone ?? "",
      ].filter(Boolean).join(" · ")}`
    : "?";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">#{row.position}</Badge>
          <span className="text-sm font-semibold">
            Party {row.party_size}{" "}
            <span className="font-normal text-muted-foreground">
              ·{" "}
              {formatDateInTz(row.reserved_at, timeZone)} ·{" "}
              {formatTimeInTz(row.reserved_at, timeZone)}
            </span>
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{guestBits}</p>
        {row.notes ? (
          <p className="mt-1 max-w-xl text-[11px] text-muted-foreground">
            Notes: {row.notes}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => void onRemove(row.id)}
        >
          Remove
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => onPromote(row)}
        >
          Promote → booking
        </Button>
      </div>
    </div>
  );
}
