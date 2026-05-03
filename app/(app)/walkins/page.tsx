"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReservationDetailDrawer } from "@/components/reservation-detail-drawer";
import { WalkinDialog } from "@/components/walkin-dialog";
import { useWalkInsList } from "@/lib/hooks/use-walk-ins";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { useUtcBootstrapDateRepair } from "@/lib/hooks/use-utc-bootstrap-date-repair";
import { useVenueTimezoneFromMeta } from "@/lib/hooks/use-venue-timezone-from-meta";
import { initials, formatTimeInTz, todayISOInTz, shiftCalendarDaysYmd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Reservation, ReservationStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: ReservationStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "no_show", label: "No-show" },
  { value: "waitlisted", label: "Waitlisted" },
];

const EMPTY_WALKINS: Reservation[] = [];

export default function WalkInsPage() {
  const storeTz = useTenantTimezone();
  const [date, setDate] = useState(() => todayISOInTz(storeTz));
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkinOpen, setWalkinOpen] = useState(false);

  const listQuery = useWalkInsList({
    date,
    status: statusFilter === "all" ? undefined : statusFilter,
    per_page: 200,
  });

  const envelope = listQuery.data;
  /** Matches WalkInService day bounds — avoids UTC fallback until /me refreshes tenant. */
  const tz =
    envelope?.meta?.walk_in_summary?.timezone?.trim() || storeTz;

  useVenueTimezoneFromMeta(envelope?.meta?.walk_in_summary?.timezone);
  useUtcBootstrapDateRepair(
    envelope?.meta?.walk_in_summary?.timezone ?? null,
    setDate,
  );

  const reservations = envelope?.data ?? EMPTY_WALKINS;
  const summary = envelope?.meta?.walk_in_summary;

  const filtered = useMemo(() => {
    if (!search.trim()) return reservations;
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      return (
        r.confirmation_code.toLowerCase().includes(q) ||
        r.guest?.name?.toLowerCase().includes(q) ||
        r.guest?.email?.toLowerCase().includes(q) ||
        r.guest?.phone?.toLowerCase().includes(q)
      );
    });
  }, [reservations, search]);

  const seatedCount = summary?.by_status?.seated ?? 0;
  const completedToday = summary?.by_status?.completed ?? 0;

  const shiftDate = (delta: number) => {
    setDate((d) => shiftCalendarDaysYmd(d, delta, tz));
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Operate" }, { label: "Walk-ins", current: true }]}
        primaryAction={{
          label: "New walk-in",
          onClick: () => setWalkinOpen(true),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Walk-ins</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Parties seated from the floor. Service day follows{" "}
              <span className="font-mono text-xs">{tz}</span> on the calendar you pick below.
              {summary != null ? (
                <>
                  {" "}
                  Ledger total {summary.total} — {completedToday} completed, {seatedCount} still
                  seated.
                </>
              ) : null}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Walk-in ledger date"
            />
            <Button variant="outline" size="icon" aria-label="Next day" onClick={() => shiftDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(todayISOInTz(tz))}>
              Today
            </Button>
          </div>
        </div>

        {summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryChip label="Total walk-ins" value={summary.total} />
            <SummaryChip label="Seated now" value={summary.by_status.seated ?? 0} />
            <SummaryChip label="Completed" value={summary.by_status.completed ?? 0} />
            <SummaryChip label="Cancelled" value={summary.by_status.cancelled ?? 0} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <span className="label-cap mr-1">Filters</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Guest, confirmation code…"
              className="h-9 w-64 pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ReservationStatus | "all")}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>

        {listQuery.isError && (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            Could not load walk-ins.
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="grid grid-cols-[68px_1fr_72px_minmax(0,140px)_120px_40px] gap-3 border-b border-border bg-muted/30 px-4 py-3 label-cap sm:grid-cols-[68px_1fr_72px_160px_120px_40px]">
            <span>Time</span>
            <span>Guest</span>
            <span>Party</span>
            <span>Table</span>
            <span>Status</span>
            <span />
          </div>

          {listQuery.isPending ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No walk-ins for this day{statusFilter !== "all" ? " with this status." : "."}
              </p>
              <Button variant="accent" size="sm" onClick={() => setWalkinOpen(true)}>
                Seat a walk-in
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <WalkInRow
                  key={r.id}
                  r={r}
                  timeZone={tz}
                  selected={selectedId === r.id}
                  onSelect={() => setSelectedId(r.id)}
                />
              ))}
            </ul>
          )}

          <footer className="flex items-center border-t border-border bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground">
            <span>
              Showing {filtered.length} walk-in
              {filtered.length === 1 ? "" : "s"}
              {filtered.length !== reservations.length ? ` (filtered from ${reservations.length})` : ""}
            </span>
            {listQuery.isFetching && !listQuery.isPending && (
              <span className="ml-auto">Refreshing…</span>
            )}
          </footer>
        </section>
      </main>

      <ReservationDetailDrawer
        reservationId={selectedId}
        onClose={() => setSelectedId(null)}
        timeZone={tz}
      />
      <WalkinDialog timeZone={tz} open={walkinOpen} onOpenChange={setWalkinOpen} />
    </>
  );
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function WalkInRow({
  r,
  timeZone,
  selected,
  onSelect,
}: {
  r: Reservation;
  timeZone: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative grid grid-cols-[68px_1fr_72px_minmax(0,140px)_120px_40px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[68px_1fr_72px_160px_120px_40px]",
        selected && "bg-muted/60",
      )}
    >
      {selected && (
        <span className="absolute left-0 top-0 h-full w-[3px] bg-foreground" />
      )}
      <span className="text-sm font-medium tabular-nums">{formatTimeInTz(r.reserved_at, timeZone)}</span>
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-[12px] font-semibold text-amber-900">
          {initials(r.guest?.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{r.guest?.name ?? "Guest"}</div>
          <div className="truncate text-[12px] text-muted-foreground">
            {r.confirmation_code}
            {r.guest?.phone ? ` · ${r.guest.phone}` : ""}
          </div>
        </div>
      </div>
      <span className="text-sm font-medium tabular-nums">{r.party_size}</span>
      <span className="truncate text-sm text-muted-foreground">
        {r.tables?.length
          ? r.tables.map((t) => (t.section ? `${t.name} · ${t.section}` : t.name)).join(", ")
          : r.table
            ? r.table.section
              ? `${r.table.name} · ${r.table.section}`
              : r.table.name
            : "—"}
      </span>
      <StatusPill status={r.status} />
      <span className="text-muted-foreground" aria-hidden>
        ⋯
      </span>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[68px_1fr_72px_minmax(0,140px)_120px_40px] items-center gap-3 px-4 py-3 sm:grid-cols-[68px_1fr_72px_160px_120px_40px]"
        >
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="space-y-1">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-4 w-6 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div />
        </li>
      ))}
    </ul>
  );
}
