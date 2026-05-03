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
import { useReservationsList } from "@/lib/hooks/use-reservations";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { useUtcBootstrapDateRepair } from "@/lib/hooks/use-utc-bootstrap-date-repair";
import {
  formatTimeInTz,
  initials,
  todayISOInTz,
  shiftCalendarDaysYmd,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Reservation,
  ReservationSource,
  ReservationStatus,
} from "@/lib/types";

const STATUS_OPTIONS: Array<{ value: ReservationStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
  { value: "waitlisted", label: "Waitlisted" },
];

export default function ReservationsPage() {
  const storeTz = useTenantTimezone();
  const [date, setDate] = useState(() => todayISOInTz(storeTz));
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">(
    "all",
  );
  const [sourceFilter, setSourceFilter] = useState<ReservationSource | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkinOpen, setWalkinOpen] = useState(false);

  const { data, isPending, isFetching, isError, error } = useReservationsList({
    date,
    status: statusFilter === "all" ? undefined : statusFilter,
    source: sourceFilter === "all" ? undefined : sourceFilter,
    per_page: 200,
  });

  const tenantTimezoneFromApi = data?.meta?.tenant_timezone?.trim();
  const displayTz = tenantTimezoneFromApi || storeTz || "UTC";

  useUtcBootstrapDateRepair(tenantTimezoneFromApi ?? null, setDate);

  const reservations = data?.data ?? [];

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

  const pendingCount = reservations.filter((r) => r.status === "pending").length;

  const shiftDate = (delta: number) => {
    setDate((d) => shiftCalendarDaysYmd(d, delta, displayTz));
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSourceFilter("all");
    setSearch("");
  };

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { label: "Operate" },
          { label: "Reservations", current: true },
        ]}
        primaryAction={{
          label: "New walk-in",
          onClick: () => setWalkinOpen(true),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reservations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {reservations.length} reservations · {pendingCount} awaiting confirmation
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => shiftDate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Reservations date"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              onClick={() => shiftDate(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(todayISOInTz(displayTz))}>
              Today
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <span className="label-cap mr-1">Filters</span>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, phone…"
              className="h-9 w-64 pl-9"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ReservationStatus | "all")}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as ReservationSource | "all")}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="walkin">Walk-in</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
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

        {isError && (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            Could not load reservations
            {error instanceof Error ? `: ${error.message}` : "."}
          </div>
        )}

        {/* Reservations table */}
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="grid grid-cols-[68px_1fr_72px_180px_88px_120px_40px] gap-3 border-b border-border bg-muted/30 px-4 py-3 label-cap">
            <span>Time</span>
            <span>Guest</span>
            <span>Party</span>
            <span>Tables</span>
            <span>Source</span>
            <span>Status</span>
            <span />
          </div>

          {isPending ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No reservations match these filters.
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <ReservationRow
                  key={r.id}
                  r={r}
                  timeZone={displayTz}
                  selected={selectedId === r.id}
                  onSelect={() => setSelectedId(r.id)}
                />
              ))}
            </ul>
          )}

          <footer className="flex items-center border-t border-border bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground">
            <span>
              Showing {filtered.length} of {reservations.length} reservations
            </span>
            {isFetching && !isPending && (
              <span className="ml-auto">Refreshing…</span>
            )}
          </footer>
        </section>
      </main>

      <ReservationDetailDrawer
        reservationId={selectedId}
        onClose={() => setSelectedId(null)}
        timeZone={displayTz}
      />
      <WalkinDialog timeZone={displayTz} open={walkinOpen} onOpenChange={setWalkinOpen} />
    </>
  );
}

function ReservationRow({
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
        "relative grid cursor-pointer grid-cols-[68px_1fr_72px_180px_88px_120px_40px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
        selected && "bg-muted/60",
      )}
    >
      {selected && (
        <span className="absolute left-0 top-0 h-full w-[3px] bg-foreground" />
      )}
      <span className="text-sm font-medium tabular-nums">
        {formatTimeInTz(r.reserved_at, timeZone)}
      </span>
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-[12px] font-semibold text-indigo-900">
          {initials(r.guest?.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {r.guest?.name ?? "Walk-in guest"}
          </div>
          <div className="truncate text-[12px] text-muted-foreground">
            {r.guest?.phone ?? r.guest?.email ?? r.confirmation_code}
          </div>
        </div>
      </div>
      <span className="text-sm font-medium tabular-nums">{r.party_size}</span>
      <span className="truncate text-sm">
        {r.tables?.length
          ? r.tables.map((t) => t.name).join(", ")
          : "—"}
      </span>
      <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {r.source}
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
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[68px_1fr_72px_180px_88px_120px_40px] items-center gap-3 px-4 py-3"
        >
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="space-y-1">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-4 w-6 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div />
        </li>
      ))}
    </ul>
  );
}
