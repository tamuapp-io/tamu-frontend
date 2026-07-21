"use client";

import { useMemo, useState } from "react";
import { Plus, Minus, Sparkles } from "lucide-react";
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
import { TableFloorPicker } from "@/components/table-floor-picker";
import { useCreateReservation } from "@/lib/hooks/use-reservations";
import { useTablesList, useFloorSections } from "@/lib/hooks/use-tables";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { ApiError } from "@/lib/api/client";
import { formatDateInTz, formatTimeInTz } from "@/lib/format";
import { toast } from "@/components/ui/toaster";
import type { Reservation } from "@/lib/types";

interface WalkinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Venue IANA zone for labels/toast (omit to use authenticated tenant). */
  timeZone?: string;
}

export function WalkinDialog({ open, onOpenChange, timeZone: timeZoneProp }: WalkinDialogProps) {
  const fallbackTz = useTenantTimezone();
  const tz = (timeZoneProp?.trim() || fallbackTz || "UTC").trim();
  const create = useCreateReservation();

  const [partySize, setPartySize] = useState(2);
  const [tableId, setTableId] = useState<string | null>(null);
  const [section, setSection] = useState<string>("all");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [duration, setDuration] = useState(90);

  const { data: floorSections = [] } = useFloorSections();
  const { data: tables = [] } = useTablesList({});

  // Sections that actually hold tables (each is its own floor plan) — managed
  // sections first in their configured order, then any legacy section still
  // present on a table.
  const sectionOptions = useMemo(() => {
    const withTables = new Set(
      tables.map((t) => (t.section ?? "").trim()).filter((s) => s !== ""),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const s of floorSections) {
      if (s.is_active === false) continue;
      if (withTables.has(s.name) && !seen.has(s.name)) {
        ordered.push(s.name);
        seen.add(s.name);
      }
    }
    for (const name of withTables) {
      if (!seen.has(name)) {
        ordered.push(name);
        seen.add(name);
      }
    }
    return ordered;
  }, [floorSections, tables]);

  // Stable ISO instant per-open so the picker doesn't refetch every render.
  // We pin it when the dialog opens; if a walk-in lingers for > a few minutes
  // the picker's conflict math is still close enough and the backend lock
  // will reject any real overlap on save.
  const reservedAtIso = useMemo(() => {
    void open; // capture dependency
    return new Date().toISOString();
  }, [open]);

  const fieldErrors =
    (create.error instanceof ApiError && create.error.errors) || {};
  const formError =
    create.error instanceof ApiError && !create.error.errors
      ? create.error.message
      : null;

  function reset() {
    setPartySize(2);
    setTableId(null);
    setSection("all");
    setName("");
    setPhone("");
    setRequests("");
    setDuration(90);
    create.reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r: Reservation = await create.mutateAsync({
        reserved_at: reservedAtIso,
        party_size: partySize,
        duration_mins: duration,
        guest: {
          name: name.trim() || "Walk-in guest",
          phone: phone.trim() || null,
        },
        special_requests: requests.trim() || undefined,
        source: "walkin",
        table_id: tableId ?? undefined,
      });
      toast.success(
        "Walked in",
        `${formatDateInTz(r.reserved_at, tz)} · ${formatTimeInTz(r.reserved_at, tz)} · party ${partySize}`,
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
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seat a walk-in</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">
              Create a reservation for right now using the venue clock below.
            </span>
            <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">
              Venue time ({tz}): {formatDateInTz(new Date(), tz)}{" "}
              {formatTimeInTz(new Date(), tz)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Party size</Label>
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                  aria-label="Decrease party size"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="flex-1 text-center text-sm font-semibold tabular-nums">
                  {partySize}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPartySize((n) => Math.min(50, n + 1))}
                  aria-label="Increase party size"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="duration">Stay duration</Label>
              <Select
                value={String(duration)}
                onValueChange={(v) => setDuration(Number(v))}
              >
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[60, 75, 90, 120, 150].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-medium">Pick a table</Label>
              <div className="flex items-center gap-2">
                {sectionOptions.length > 0 && (
                  <Select
                    value={section}
                    onValueChange={(v) => {
                      setSection(v);
                      // The picked table may not live in the new section.
                      setTableId(null);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[150px]" aria-label="Floor section">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {sectionOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant={tableId === null ? "accent" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setTableId(null)}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {tableId === null ? "Auto-assigning" : "Auto-assign instead"}
                </Button>
              </div>
            </div>
            <TableFloorPicker
              reservedAt={reservedAtIso}
              durationMins={duration}
              partySize={partySize}
              value={tableId}
              onChange={setTableId}
              section={section}
            />
            {fieldErrors.table_id?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.table_id[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-name">Guest name (optional)</Label>
              <Input
                id="walkin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Andi"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-phone">Phone (optional)</Label>
              <Input
                id="walkin-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 ..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walkin-req">Special requests</Label>
            <Input
              id="walkin-req"
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              placeholder="High chair, allergy, etc."
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending} variant="accent">
              {create.isPending ? "Seating…" : "Seat now"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
