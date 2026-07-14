"use client";

import { use } from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, Check, LayoutGrid, Users, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { StatusPill } from "@/components/status-pill";
import { publicBookingApi } from "@/lib/api/public-booking";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";
import { formatGuestAssignedTables, formatMoney } from "@/lib/format";

export default function ManageBookingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const qc = useQueryClient();
  const queryKey = ["public", "manage", code];

  const reservationQuery = useQuery({
    queryKey,
    queryFn: async () => (await publicBookingApi.show(code)).data,
    retry: false,
    // After a deposit redirect the booking is pending until the webhook lands;
    // poll so the page flips to confirmed on its own.
    refetchInterval: (q) => {
      const res = q.state.data;
      return res && res.status === "pending" && res.payment?.status === "pending"
        ? 3000
        : false;
    },
  });

  const cancel = useMutation({
    mutationFn: (reason: string | undefined) =>
      publicBookingApi.cancel(code, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");

  if (reservationQuery.isLoading) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (reservationQuery.isError) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-3 text-lg font-semibold">
            We couldn&apos;t find this booking
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The confirmation code may have a typo or the booking has been removed.
          </p>
        </Card>
      </div>
    );
  }

  const r = reservationQuery.data!;
  const tz = r.restaurant_timezone ?? "UTC";
  const isSpa = !!r.service;
  const isCancellable = !["cancelled", "no_show", "completed", "seated"].includes(
    r.status,
  );
  const tablesLabel = formatGuestAssignedTables(r.assigned_tables);

  async function handleCancel() {
    try {
      await cancel.mutateAsync(reason.trim() || undefined);
      toast.success("Booking cancelled");
      setConfirmCancel(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not cancel";
      toast.error("Cancel failed", msg);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-4 pt-10 sm:p-8">
      <Card className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="label-cap">Your booking</span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {r.guest?.name ?? "Reservation"}
            </h1>
          </div>
          <StatusPill status={r.status} />
        </div>

        <dl className="mt-6 grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> When
          </dt>
          <dd className="font-medium">
            {new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: tz,
            }).format(new Date(r.reserved_at))}
          </dd>

          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {isSpa ? "Treatment" : "Party"}
          </dt>
          <dd className="font-medium">
            {isSpa
              ? r.service?.name ?? "—"
              : `${r.party_size} ${r.party_size === 1 ? "guest" : "guests"}`}
          </dd>

          {isSpa && r.therapist && (
            <>
              <dt className="text-muted-foreground">Therapist</dt>
              <dd className="font-medium">{r.therapist.name}</dd>
            </>
          )}

          {!isSpa && tablesLabel && (
            <>
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" /> Table
              </dt>
              <dd className="font-medium">{tablesLabel}</dd>
            </>
          )}

          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-mono">{r.confirmation_code}</dd>

          {r.guest?.email && (
            <>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{r.guest.email}</dd>
            </>
          )}

          {r.special_requests && (
            <>
              <dt className="text-muted-foreground">Requests</dt>
              <dd>{r.special_requests}</dd>
            </>
          )}
        </dl>

        {r.status === "cancelled" && (
          <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This booking has been cancelled.
          </p>
        )}

        {r.status === "completed" && (
          <p className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <Check className="mr-1 inline h-4 w-4" /> Thanks for visiting!
          </p>
        )}

        {r.payment && r.deposit_cents ? (
          r.payment.status === "paid" ? (
            <p className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <Check className="mr-1 inline h-4 w-4" /> Deposit of{" "}
              {formatMoney(r.deposit_cents, r.payment.currency)} paid — your booking is confirmed.
            </p>
          ) : r.payment.status === "pending" ? (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">
                Deposit of {formatMoney(r.deposit_cents, r.payment.currency)} required
              </p>
              <p className="mt-1 text-amber-800">
                Your slot is held until the deposit is paid. If you haven&apos;t finished
                checkout, you can complete it now.
              </p>
              {r.payment.invoice_url && (
                <a
                  href={r.payment.invoice_url}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-primary-foreground"
                >
                  Complete deposit payment
                </a>
              )}
            </div>
          ) : (
            <p className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              The deposit payment expired, so this booking was released.
            </p>
          )
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {isCancellable && (
            <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
              <X className="h-4 w-4" /> Cancel booking
            </Button>
          )}
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Done
          </Link>
        </div>
      </Card>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              You can rebook later if your plans change.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="m-reason">Reason (optional)</Label>
            <Input
              id="m-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Plans changed"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
