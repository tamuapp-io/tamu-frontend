"use client";

import { useMemo, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { KpiStat } from "@/components/kpi-stat";
import { ServiceTimeline } from "@/components/service-timeline";
import { SpaServiceTimeline } from "@/components/spa-service-timeline";
import { SpaRoomsBoard } from "@/components/spa-rooms-board";
import { FloorPlanPreview } from "@/components/floor-plan-preview";
import { WalkinDialog } from "@/components/walkin-dialog";
import { SpaWalkinDialog } from "@/components/spa-walkin-dialog";
import { ReservationDetailDrawer } from "@/components/reservation-detail-drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useReservationsList } from "@/lib/hooks/use-reservations";
import { useTablesList } from "@/lib/hooks/use-tables";
import { useTherapistsList, useRoomsList } from "@/lib/hooks/use-spa-catalog";
import { useCategory } from "@/lib/hooks/use-category";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { useUtcBootstrapDateRepair } from "@/lib/hooks/use-utc-bootstrap-date-repair";
import { useVenueTimezoneFromMeta } from "@/lib/hooks/use-venue-timezone-from-meta";
import {
  todayISOInTz,
  shiftCalendarDaysYmd,
  formatCalendarYmdLabel,
  formatTimeInTz,
  statusClass,
  statusLabel,
  initials,
  instantFromApi,
} from "@/lib/format";
import type { Reservation } from "@/lib/types";

export default function LivePage() {
  const { isSpa, term } = useCategory();
  const storeTz = useTenantTimezone();
  const [date, setDate] = useState(() => todayISOInTz(storeTz));
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const reservationsQuery = useReservationsList({ date, per_page: 200 });
  const tablesQuery = useTablesList({ per_page: 200 });
  const therapistsQuery = useTherapistsList();
  const roomsQuery = useRoomsList();

  const tenantTimezoneFromApi = reservationsQuery.data?.meta?.tenant_timezone?.trim();
  const displayTz = tenantTimezoneFromApi || storeTz || "UTC";

  useVenueTimezoneFromMeta(tenantTimezoneFromApi);
  useUtcBootstrapDateRepair(tenantTimezoneFromApi ?? null, setDate);

  const reservations = reservationsQuery.data?.data ?? [];
  const tables = tablesQuery.data ?? [];
  const therapists = therapistsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];

  const stats = useMemo(() => {
    const valid = reservations.filter(
      (r) => r.status !== "cancelled" && r.status !== "no_show",
    );

    if (isSpa) {
      const inService = reservations.filter(
        (r) => r.status === "seated" || r.status === "completed",
      ).length;
      const cancellations = reservations.filter(
        (r) => r.status === "cancelled" || r.status === "no_show",
      ).length;
      const activeRooms = rooms.filter((r) => r.is_active).length;
      const roomsInUse = new Set(
        reservations
          .filter((r) => r.status === "seated" && (r.room_id || r.room?.id))
          .map((r) => r.room_id ?? r.room?.id),
      ).size;
      const roomUtil =
        activeRooms > 0 ? Math.round((roomsInUse / activeRooms) * 100) : 0;

      return {
        appointments: valid.length,
        total: reservations.length,
        inService,
        cancellations,
        roomUtil,
      };
    }

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
  }, [reservations, tables, rooms, isSpa]);

  const upcoming = useMemo(() => {
    const now = new Date().getTime();
    const cutoff = now + 30 * 60_000;
    return reservations
      .filter((r) => {
        if (r.status !== "confirmed" && r.status !== "pending") return false;
        const start = instantFromApi(r.reserved_at).getTime();
        return start >= now && start <= cutoff;
      })
      .sort(
        (a, b) =>
          instantFromApi(a.reserved_at).getTime() -
          instantFromApi(b.reserved_at).getTime(),
      )
      .slice(0, 5);
  }, [reservations]);

  const shiftDate = (deltaDays: number) => {
    setDate((d) => shiftCalendarDaysYmd(d, deltaDays, displayTz));
  };

  const reservationsLabel = term("reservations", "Reservations");
  const resourceLabel = term("resource", "Therapist");

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { label: "Operate" },
          {
            label: isSpa ? "Live schedule" : "Live service",
            current: true,
          },
        ]}
        primaryAction={
          isSpa
            ? undefined
            : {
                label: "Walk-in",
                onClick: () => setWalkinOpen(true),
                icon: <UserPlus className="h-4 w-4" />,
              }
        }
      />

      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSpa ? "Today's schedule" : "Tonight's service"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSpa ? (
                <>
                  {reservations.length} {reservationsLabel.toLowerCase()} ·{" "}
                  {therapists.filter((t) => t.is_active).length} active{" "}
                  {resourceLabel.toLowerCase()}s ·{" "}
                  {rooms.filter((r) => r.is_active).length} rooms
                </>
              ) : (
                <>
                  {reservations.length} reservation
                  {reservations.length === 1 ? "" : "s"} · {stats.covers} covers ·
                  {tables.filter((t) => t.status === "active").length} active tables
                </>
              )}
            </p>
          </div>
          <DateControls
            date={date}
            displayTz={displayTz}
            onDateChange={setDate}
            onShift={shiftDate}
          />
        </div>

        {isSpa ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiStat
              label={`Today's ${reservationsLabel.toLowerCase()}`}
              value={stats.appointments ?? 0}
              description={`${stats.total} total · ${formatCalendarYmdLabel(date, displayTz)}`}
              loading={reservationsQuery.isPending}
            />
            <KpiStat
              label="In service"
              value={stats.inService ?? 0}
              description="Seated or completed"
              loading={reservationsQuery.isPending}
            />
            <KpiStat
              label="Cancellations"
              value={stats.cancellations ?? 0}
              description="Cancellations + no-shows"
              loading={reservationsQuery.isPending}
            />
            <KpiStat
              label="Room utilization"
              value={`${stats.roomUtil ?? 0}%`}
              description="Rooms in use now"
              loading={reservationsQuery.isPending || roomsQuery.isPending}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiStat
              label="Today's covers"
              value={stats.covers ?? 0}
              description={`${stats.total} reservations · ${formatCalendarYmdLabel(date, displayTz)}`}
              loading={reservationsQuery.isPending}
            />
            <KpiStat
              label="Checked in"
              value={stats.checkedIn ?? 0}
              description="Seated or completed"
              loading={reservationsQuery.isPending}
            />
            <KpiStat
              label="Cancellations"
              value={stats.cancellations ?? 0}
              description="Cancellations + no-shows"
              loading={reservationsQuery.isPending}
            />
            <KpiStat
              label="Occupancy"
              value={`${stats.occupancy ?? 0}%`}
              description="Seated covers / max capacity"
              loading={reservationsQuery.isPending || tablesQuery.isPending}
            />
          </div>
        )}

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
                No {isSpa ? "appointments" : "arrivals"} in the next 30 minutes.
              </span>
            ) : (
              upcoming.map((r) => (
                <UpcomingChip
                  key={r.id}
                  reservation={r}
                  timeZone={displayTz}
                  isSpa={isSpa}
                  onClick={() => setOpenId(r.id)}
                />
              ))
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {isSpa ? (
            <>
              <SpaServiceTimeline
                reservations={reservations}
                therapists={therapists}
                tenantTimeZone={displayTz}
                resourceLabel={resourceLabel}
                onReservationClick={(r) => setOpenId(r.id)}
              />
              <SpaRoomsBoard
                rooms={rooms}
                reservations={reservations}
                tenantTimeZone={displayTz}
                onReservationClick={(r) => setOpenId(r.id)}
              />
            </>
          ) : (
            <>
              <ServiceTimeline
                reservations={reservations}
                tables={tables}
                tenantTimeZone={displayTz}
                onReservationClick={(r) => setOpenId(r.id)}
              />
              <FloorPlanPreview tables={tables} reservations={reservations} />
            </>
          )}
        </div>
      </main>

      {isSpa ? (
        <SpaWalkinDialog timeZone={displayTz} open={walkinOpen} onOpenChange={setWalkinOpen} />
      ) : (
        <WalkinDialog timeZone={displayTz} open={walkinOpen} onOpenChange={setWalkinOpen} />
      )}
      <ReservationDetailDrawer
        reservationId={openId}
        onClose={() => setOpenId(null)}
        timeZone={displayTz}
      />
    </>
  );
}

function DateControls({
  date,
  displayTz,
  onDateChange,
  onShift,
}: {
  date: string;
  displayTz: string;
  onDateChange: (d: string) => void;
  onShift: (delta: number) => void;
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous day"
        onClick={() => onShift(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Service date"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Next day"
        onClick={() => onShift(1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onDateChange(todayISOInTz(displayTz))}>
        Today
      </Button>
    </div>
  );
}

function UpcomingChip({
  reservation,
  timeZone,
  isSpa,
  onClick,
}: {
  reservation: Reservation;
  timeZone: string;
  isSpa: boolean;
  onClick: () => void;
}) {
  const detail = isSpa
    ? reservation.service?.name ?? "Treatment"
    : `${reservation.party_size}p`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill ${statusClass(reservation.status)} max-w-[280px] cursor-pointer gap-2 hover:opacity-90`}
      title={`${reservation.guest?.name ?? "Guest"} · ${formatTimeInTz(reservation.reserved_at, timeZone)} · ${detail}`}
    >
      <span className="dot" aria-hidden />
      <span className="grid h-5 w-5 place-items-center rounded-full bg-black/10 text-[10px] font-semibold">
        {initials(reservation.guest?.name)}
      </span>
      <span className="truncate text-xs font-medium">
        {reservation.guest?.name ?? "Guest"}
      </span>
      <span className="text-[10px] tabular-nums">
        {formatTimeInTz(reservation.reserved_at, timeZone)} · {detail}
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">
        {statusLabel(reservation.status)}
      </span>
    </button>
  );
}
