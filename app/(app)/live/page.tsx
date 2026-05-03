"use client";

import { useMemo, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { KpiStat } from "@/components/kpi-stat";
import { ServiceTimeline } from "@/components/service-timeline";
import { FloorPlanPreview } from "@/components/floor-plan-preview";
import { WalkinDialog } from "@/components/walkin-dialog";
import { ReservationDetailDrawer } from "@/components/reservation-detail-drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useReservationsList } from "@/lib/hooks/use-reservations";
import { useTablesList } from "@/lib/hooks/use-tables";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { useUtcBootstrapDateRepair } from "@/lib/hooks/use-utc-bootstrap-date-repair";
import {
  todayISOInTz,
  shiftCalendarDaysYmd,
  formatCalendarYmdLabel,
  formatTimeInTz,
  statusClass,
  statusLabel,
  initials,
} from "@/lib/format";
import type { Reservation } from "@/lib/types";

export default function LivePage() {
  const storeTz = useTenantTimezone();
  const [date, setDate] = useState(() => todayISOInTz(storeTz));
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const reservationsQuery = useReservationsList({ date, per_page: 200 });
  const tablesQuery = useTablesList({ per_page: 200 });

  const tenantTimezoneFromApi = reservationsQuery.data?.meta?.tenant_timezone?.trim();
  const displayTz = tenantTimezoneFromApi || storeTz || "UTC";

  useUtcBootstrapDateRepair(tenantTimezoneFromApi ?? null, setDate);

  const reservations = reservationsQuery.data?.data ?? [];
  const tables = tablesQuery.data ?? [];

  const stats = useMemo(() => {
    const valid = reservations.filter(
      (r) => r.status !== "cancelled" && r.status !== "no_show",
    );
    const covers = valid.reduce((sum, r) => sum + r.party_size, 0);
    const checkedIn = reservations.filter(
      (r) => r.status === "seated" || r.status === "completed",
    ).length;
    const cancellations = reservations.filter(
      (r) => r.status === "cancelled" || r.status === "no_show",
    ).length;

    const totalCapacity = tables
      .filter((t) => t.status === "active")
      .reduce((sum, t) => sum + t.max_capacity, 0);
    const seatedNow = reservations
      .filter((r) => r.status === "seated")
      .reduce((sum, r) => sum + r.party_size, 0);
    const occupancy =
      totalCapacity > 0 ? Math.round((seatedNow / totalCapacity) * 100) : 0;

    return {
      covers,
      total: reservations.length,
      checkedIn,
      cancellations,
      occupancy,
    };
  }, [reservations, tables]);

  const upcoming = useMemo(() => {
    const now = new Date().getTime();
    const cutoff = now + 30 * 60_000;
    return reservations
      .filter((r) => {
        if (r.status !== "confirmed" && r.status !== "pending") return false;
        const start = new Date(r.reserved_at).getTime();
        return start >= now && start <= cutoff;
      })
      .sort(
        (a, b) =>
          new Date(a.reserved_at).getTime() - new Date(b.reserved_at).getTime(),
      )
      .slice(0, 5);
  }, [reservations]);

  const shiftDate = (deltaDays: number) => {
    setDate((d) => shiftCalendarDaysYmd(d, deltaDays, displayTz));
  };

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { label: "Operate" },
          { label: "Live service", current: true },
        ]}
        primaryAction={{
          label: "Walk-in",
          onClick: () => setWalkinOpen(true),
          icon: <UserPlus className="h-4 w-4" />,
        }}
      />

      <main className="flex-1 space-y-6 p-6">
        {/* Page heading */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tonight&apos;s service
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {reservations.length} reservation
              {reservations.length === 1 ? "" : "s"} · {stats.covers} covers ·
              {tables.filter((t) => t.status === "active").length} active tables
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
              aria-label="Service date"
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

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiStat
            label="Today's covers"
            value={stats.covers}
            description={`${stats.total} reservations · ${formatCalendarYmdLabel(date, displayTz)}`}
            loading={reservationsQuery.isPending}
          />
          <KpiStat
            label="Checked in"
            value={stats.checkedIn}
            description="Seated or completed"
            loading={reservationsQuery.isPending}
          />
          <KpiStat
            label="Cancellations"
            value={stats.cancellations}
            description="Cancellations + no-shows"
            loading={reservationsQuery.isPending}
          />
          <KpiStat
            label="Occupancy"
            value={`${stats.occupancy}%`}
            description="Seated covers / max capacity"
            loading={reservationsQuery.isPending || tablesQuery.isPending}
          />
        </div>

        {/* Upcoming alert strip */}
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-50 text-amber-800">
              <Bell className="h-3.5 w-3.5" />
            </span>
            <span>Upcoming · next 30 min</span>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {upcoming.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                No arrivals in the next 30 minutes.
              </span>
            ) : (
              upcoming.map((r) => (
                <UpcomingChip
                  key={r.id}
                  reservation={r}
                  timeZone={displayTz}
                  onClick={() => setOpenId(r.id)}
                />
              ))
            )}
          </div>
        </Card>

        {/* Timeline + Floor plan split */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
          <ServiceTimeline
            reservations={reservations}
            tables={tables}
            tenantTimeZone={displayTz}
            onReservationClick={(r) => setOpenId(r.id)}
          />
          <FloorPlanPreview tables={tables} reservations={reservations} />
        </div>
      </main>

      <WalkinDialog timeZone={displayTz} open={walkinOpen} onOpenChange={setWalkinOpen} />
      <ReservationDetailDrawer
        reservationId={openId}
        onClose={() => setOpenId(null)}
        timeZone={displayTz}
      />
    </>
  );
}

function UpcomingChip({
  reservation,
  timeZone,
  onClick,
}: {
  reservation: Reservation;
  timeZone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill ${statusClass(reservation.status)} max-w-[260px] cursor-pointer gap-2 hover:opacity-90`}
      title={`${reservation.guest?.name ?? "Walk-in"} · ${formatTimeInTz(reservation.reserved_at, timeZone)} · ${reservation.party_size} ppl`}
    >
      <span className="dot" aria-hidden />
      <span className="grid h-5 w-5 place-items-center rounded-full bg-black/10 text-[10px] font-semibold">
        {initials(reservation.guest?.name)}
      </span>
      <span className="truncate text-xs font-medium">
        {reservation.guest?.name ?? "Walk-in"}
      </span>
      <span className="text-[10px] tabular-nums">
        {formatTimeInTz(reservation.reserved_at, timeZone)} · {reservation.party_size}p
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">
        {statusLabel(reservation.status)}
      </span>
    </button>
  );
}
