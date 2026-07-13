"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateReservation } from "@/lib/hooks/use-reservations";
import { useServicesList, useTherapistsList } from "@/lib/hooks/use-spa-catalog";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { useCategory } from "@/lib/hooks/use-category";
import { ApiError } from "@/lib/api/client";
import { formatDateInTz, formatServicePrice, formatTimeInTz } from "@/lib/format";
import { toast } from "@/components/ui/toaster";
import type { Reservation } from "@/lib/types";

const ANY_THERAPIST = "any";

interface SpaWalkinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Venue IANA zone for labels/toast (omit to use authenticated tenant). */
  timeZone?: string;
}

export function SpaWalkinDialog({ open, onOpenChange, timeZone: timeZoneProp }: SpaWalkinDialogProps) {
  const fallbackTz = useTenantTimezone();
  const tz = (timeZoneProp?.trim() || fallbackTz || "UTC").trim();
  const { term } = useCategory();
  const resourceLabel = term("resource", "Therapist");

  const create = useCreateReservation();
  const { data: services = [] } = useServicesList();
  const { data: therapists = [] } = useTherapistsList();

  const [serviceId, setServiceId] = useState<string>("");
  const [therapistId, setTherapistId] = useState<string>(ANY_THERAPIST);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");

  const activeServices = useMemo(() => services.filter((s) => s.is_active), [services]);
  const selectedService = activeServices.find((s) => s.id === serviceId);

  // Therapists who can perform the chosen service (and are active).
  const eligibleTherapists = useMemo(() => {
    const active = therapists.filter((t) => t.is_active);
    if (!selectedService) return active;
    const ids = new Set(selectedService.therapist_ids ?? []);
    return ids.size > 0 ? active.filter((t) => ids.has(t.id)) : active;
  }, [therapists, selectedService]);

  // Stable "now" per-open so the request targets the moment the dialog opened.
  const reservedAtIso = useMemo(() => {
    void open;
    return new Date().toISOString();
  }, [open]);

  const fieldErrors = (create.error instanceof ApiError && create.error.errors) || {};
  const formError =
    create.error instanceof ApiError && !create.error.errors ? create.error.message : null;

  function reset() {
    setServiceId("");
    setTherapistId(ANY_THERAPIST);
    setName("");
    setPhone("");
    setRequests("");
    create.reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId) return;
    try {
      const r: Reservation = await create.mutateAsync({
        reserved_at: reservedAtIso,
        service_id: serviceId,
        therapist_id: therapistId === ANY_THERAPIST ? undefined : therapistId,
        guest: {
          name: name.trim() || "Walk-in guest",
          phone: phone.trim() || null,
        },
        special_requests: requests.trim() || undefined,
        source: "walkin",
      });
      toast.success(
        "Walk-in started",
        `${formatDateInTz(r.reserved_at, tz)} · ${formatTimeInTz(r.reserved_at, tz)}`,
      );
      reset();
      onOpenChange(false);
    } catch {
      // shown inline
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a walk-in</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">
              Start an appointment for right now — the room and {resourceLabel.toLowerCase()} go in
              use immediately.
            </span>
            <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">
              Venue time ({tz}): {formatDateInTz(new Date(), tz)} {formatTimeInTz(new Date(), tz)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="spa-service">Service</Label>
            <Select
              value={serviceId}
              onValueChange={(v) => {
                setServiceId(v);
                setTherapistId(ANY_THERAPIST);
              }}
            >
              <SelectTrigger id="spa-service">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {activeServices.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No active services.</div>
                ) : (
                  activeServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.duration_mins} min
                      {s.price_cents > 0 ? ` · ${formatServicePrice(s.price_cents, s.currency)}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {fieldErrors.service_id?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.service_id[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spa-therapist">{resourceLabel}</Label>
            <Select value={therapistId} onValueChange={setTherapistId}>
              <SelectTrigger id="spa-therapist">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_THERAPIST}>Any available</SelectItem>
                {eligibleTherapists.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.therapist_id?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.therapist_id[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="spa-walkin-name">Guest name (optional)</Label>
              <Input
                id="spa-walkin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Andi"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spa-walkin-phone">Phone (optional)</Label>
              <Input
                id="spa-walkin-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 ..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spa-walkin-req">Notes</Label>
            <Input
              id="spa-walkin-req"
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              placeholder="Allergies, preferences, etc."
            />
          </div>

          {formError && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !serviceId} variant="accent">
              {create.isPending ? "Starting…" : "Start now"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
