"use client";

import { useState } from "react";
import { Cake, Check, MoveRight, UserMinus, UserCheck, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { GuestWhatsappButton } from "@/components/guest-whatsapp-button";
import { ReturningGuestBadge } from "@/components/returning-guest-badge";
import { StatusPill } from "@/components/status-pill";
import {
  useReservation,
  useCancelReservation,
  useTransitionReservation,
  useReassignReservationTable,
  useAddReservationNote,
} from "@/lib/hooks/use-reservations";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { formatDateInTz, formatTimeInTz, initials } from "@/lib/format";
import { TableFloorPicker } from "@/components/table-floor-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import type { Reservation, ReservationStatus } from "@/lib/types";
import type { StaffReservationTransition } from "@/lib/api/reservations";

interface ReservationDetailDrawerProps {
  reservationId: string | null;
  onClose: () => void;
  /** Venue IANA zone for booking instants; falls back to session tenant timezone. */
  timeZone?: string;
}

const NEXT_STATES: Record<ReservationStatus, StaffReservationTransition[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["seated", "no_show", "cancelled"],
  seated: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
  waitlisted: ["confirmed", "cancelled"],
};

const TRANSITION_LABEL: Record<StaffReservationTransition, string> = {
  confirmed: "Confirm",
  seated: "Seat now",
  completed: "Complete",
  no_show: "Mark no-show",
  cancelled: "Cancel",
};

const TRANSITION_ICON: Record<StaffReservationTransition, React.ReactNode> = {
  confirmed: <Check className="h-4 w-4" />,
  seated: <UserCheck className="h-4 w-4" />,
  completed: <Check className="h-4 w-4" />,
  no_show: <UserMinus className="h-4 w-4" />,
  cancelled: <X className="h-4 w-4" />,
};

export function ReservationDetailDrawer({
  reservationId,
  onClose,
  timeZone: timeZoneProp,
}: ReservationDetailDrawerProps) {
  const open = !!reservationId;
  const storeTz = useTenantTimezone();
  const tz = (timeZoneProp?.trim() || storeTz || "UTC").trim();
  const { data: r, isPending } = useReservation(reservationId);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const transition = useTransitionReservation();

  const allowed = r ? NEXT_STATES[r.status] ?? [] : [];
  const primaryAction = allowed.find((s) => s !== "cancelled" && s !== "no_show");

  async function runTransition(status: StaffReservationTransition) {
    if (!r) return;
    try {
      await transition.mutateAsync({ id: r.id, status });
      toast.success("Reservation updated", `Now ${status.replace("_", " ")}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not update";
      toast.error("Action failed", message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="overflow-y-auto p-0">
        <SheetHeader className="flex-row! items-start gap-3 border-b-0! pb-3!">
          {!r ? (
            <SheetTitle className="sr-only">
              {isPending ? "Loading reservation" : "Reservation details"}
            </SheetTitle>
          ) : (
            <>
              <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-900">
                {initials(r.guest?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  {r.guest?.name ?? "Walk-in guest"}
                  <ReturningGuestBadge totalBookings={r.guest?.total_bookings} />
                </SheetTitle>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {r.confirmation_code}
                  </span>
                  <StatusPill status={r.status} />
                </div>
              </div>
            </>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {isPending && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          )}

          {r && (
            <>
              <section>
                <div className="label-cap mb-2">Reservation</div>
                <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Date &amp; time</dt>
                  <dd className="font-medium tabular-nums">
                    {formatDateInTz(r.reserved_at, tz)} · {formatTimeInTz(r.reserved_at, tz)}
                  </dd>
                  <dt className="text-muted-foreground">Party size</dt>
                  <dd className="font-medium tabular-nums">
                    {r.party_size} {r.party_size === 1 ? "guest" : "guests"}
                  </dd>
                  <dt className="text-muted-foreground">Table</dt>
                  <dd className="font-medium">
                    {r.table?.name
                      ?? (r.tables && r.tables.length > 0
                        ? r.tables.map((t) => t.name).join(", ")
                        : "—")}
                  </dd>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="font-medium tabular-nums">
                    {r.duration_mins} minutes
                  </dd>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="capitalize">{r.source}</dd>
                  {r.occasion && (
                    <>
                      <dt className="text-muted-foreground">Occasion</dt>
                      <dd className="flex items-center gap-2">
                        <Cake className="h-4 w-4 text-amber-600" /> {r.occasion}
                      </dd>
                    </>
                  )}
                </dl>
              </section>

              {r.special_requests && (
                <section>
                  <div className="label-cap mb-2">Special requests</div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed">
                    {r.special_requests}
                  </div>
                </section>
              )}

              {r.guest && (
                <section>
                  <div className="label-cap mb-2">Guest</div>
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{r.guest.name ?? "—"}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.guest.phone ?? "No phone"} · {r.guest.email ?? "No email"}
                        </div>
                        {(r.guest.total_bookings ?? 0) > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground tabular-nums">
                              {r.guest.total_bookings}
                            </span>{" "}
                            booking{r.guest.total_bookings === 1 ? "" : "s"} on file
                            {(r.guest.total_bookings ?? 0) > 1 ? " — returning guest" : ""}
                          </div>
                        )}
                      </div>
                      <GuestWhatsappButton
                        phone={r.guest.phone}
                        guestId={r.guest.id}
                        name={r.guest.name}
                      />
                    </div>
                  </div>
                </section>
              )}

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label-cap">Staff notes</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNoteOpen(true)}
                  >
                    Add note
                  </Button>
                </div>
                {r.staff_notes ? (
                  <pre className="whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 p-3 font-sans text-xs leading-relaxed text-amber-900">
                    {r.staff_notes}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No notes yet.
                  </p>
                )}
              </section>

              <section>
                <div className="label-cap mb-2">Payment</div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                  <div className="grid h-9 w-9 place-items-center rounded bg-emerald-50 text-emerald-700">
                    ✓
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Deposit not required</div>
                    <div className="text-xs text-muted-foreground">
                      Phase 2 lights up payments. PRD §10.
                    </div>
                  </div>
                  <span className="pill completed">
                    <span className="dot" aria-hidden />
                    Free
                  </span>
                </div>
              </section>
            </>
          )}
        </div>

        {r && (
          <SheetFooter className="mt-0! flex-col! items-stretch gap-3 sm:flex-col!">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Next valid states:{" "}
              {allowed.length === 0 ? (
                <em>terminal</em>
              ) : (
                allowed.map((a) => a.replace("_", " ")).join(" · ")
              )}
            </p>

            {primaryAction && (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => runTransition(primaryAction)}
                  disabled={transition.isPending}
                >
                  {TRANSITION_ICON[primaryAction]}{" "}
                  {TRANSITION_LABEL[primaryAction]}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMoveOpen(true)}
                  disabled={r.status === "completed" || r.status === "cancelled" || r.status === "no_show"}
                >
                  <MoveRight className="h-4 w-4" /> Move table
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              {allowed.includes("no_show") && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => runTransition("no_show")}
                  disabled={transition.isPending}
                >
                  <UserMinus className="h-4 w-4" /> Mark no-show
                </Button>
              )}
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setConfirmCancel(true)}
                disabled={!allowed.includes("cancelled")}
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>

      {r && (
        <>
          <CancelReservationDialog
            reservationId={r.id}
            guestName={r.guest?.name ?? "this reservation"}
            open={confirmCancel}
            onOpenChange={setConfirmCancel}
            onCancelled={onClose}
          />
          <MoveTableDialog
            key={r.id}
            reservation={r}
            timeZone={tz}
            open={moveOpen}
            onOpenChange={setMoveOpen}
          />
          <AddNoteDialog
            reservationId={r.id}
            open={noteOpen}
            onOpenChange={setNoteOpen}
          />
        </>
      )}
    </Sheet>
  );
}

function CancelReservationDialog({
  reservationId,
  guestName,
  open,
  onOpenChange,
  onCancelled,
}: {
  reservationId: string;
  guestName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}) {
  const cancel = useCancelReservation();
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    try {
      await cancel.mutateAsync({ id: reservationId, reason: reason.trim() || undefined });
      toast.success("Reservation cancelled");
      onOpenChange(false);
      onCancelled();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not cancel reservation";
      toast.error("Cancel failed", message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel reservation?</DialogTitle>
          <DialogDescription>
            This will free the assigned table and notify {guestName}. The booking
            cannot be re-confirmed afterwards — create a new one if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Input
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Guest requested move to next week"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep reservation
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? "Cancelling…" : "Yes, cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveTableDialog({
  reservation,
  timeZone,
  open,
  onOpenChange,
}: {
  reservation: Reservation;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reassign = useReassignReservationTable();
  const [tableId, setTableId] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setTableId(null);
    }
    onOpenChange(next);
  }

  async function handleMove() {
    if (!tableId) return;
    try {
      await reassign.mutateAsync({ id: reservation.id, table_id: tableId });
      toast.success("Table reassigned");
      handleOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not move table";
      toast.error("Move failed", message);
    }
  }

  const currentTableName =
    reservation.table?.name ??
    reservation.tables?.map((t) => t.name).join(", ") ??
    null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Move to a different table</DialogTitle>
          <DialogDescription>
            Pick any available table for {reservation.party_size} guests at{" "}
            {formatTimeInTz(reservation.reserved_at, timeZone)}.
            {currentTableName ? (
              <>
                {" "}Currently on{" "}
                <span className="font-medium text-foreground">{currentTableName}</span>.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <TableFloorPicker
            reservedAt={reservation.reserved_at}
            durationMins={reservation.duration_mins}
            partySize={reservation.party_size}
            value={tableId}
            onChange={setTableId}
            excludeReservationId={reservation.id}
            currentTableId={reservation.table_id ?? undefined}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!tableId || reassign.isPending}
          >
            {reassign.isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddNoteDialog({
  reservationId,
  open,
  onOpenChange,
}: {
  reservationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddReservationNote();
  const [note, setNote] = useState("");

  async function handleSave() {
    if (!note.trim()) return;
    try {
      await add.mutateAsync({ id: reservationId, note: note.trim() });
      toast.success("Note added");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save note";
      toast.error("Save failed", message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add staff note</DialogTitle>
          <DialogDescription>
            Internal — not visible to guests. Notes are timestamped and appended.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="note-body">Note</Label>
          <textarea
            id="note-body"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={1000}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. Anniversary — wants the corner booth, allergic to peanuts"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!note.trim() || add.isPending}>
            {add.isPending ? "Saving…" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
