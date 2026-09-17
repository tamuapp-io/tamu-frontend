"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useEventTables, useSyncEventTables } from "@/lib/hooks/use-events";
import { useFloorSections, useTablesList } from "@/lib/hooks/use-tables";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventTablePayloadRow, FloorSection, Table } from "@/lib/types";

/** Draft state per table: attached, and the override typed in (blank = none). */
type Draft = Record<string, { on: boolean; price: string }>;

const toCents = (rupiah: string): number | null => {
  const t = rupiah.trim();
  if (t === "") return null;
  const n = Number.parseInt(t.replace(/[^\d]/g, ""), 10);

  return Number.isFinite(n) ? n * 100 : null;
};

const toRupiah = (cents: number | null | undefined): string =>
  cents == null ? "" : String(Math.round(cents / 100));

/**
 * Attach tables to an event and price them for the hours it runs.
 *
 * Deliberately a plain list rather than the floor picker. That component wants a
 * `reservedAt`, a `durationMins` and a `partySize`, and fetches the day's
 * reservations to shade tables busy — none of which mean anything here. An event
 * runs across a window, and "is this table taken right now" has no bearing on
 * "does it cost more tonight"; feeding it a made-up instant would buy a prettier
 * picker that shows misleading states.
 */
export function EventTablesTab({
  eventId,
  eventHasEndTime,
}: {
  eventId: string;
  /** Drives the copy about the fallback pricing window. */
  eventHasEndTime: boolean;
}) {
  const query = useEventTables(eventId);
  const save = useSyncEventTables(eventId);
  const { data: tables = [] } = useTablesList({});
  const { data: sections = [] } = useFloorSections();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulk, setBulk] = useState("");

  // Derived from the server until something is typed — no setState in an effect.
  const server: Draft = useMemo(() => {
    const out: Draft = {};

    for (const row of query.data?.tables ?? []) {
      out[row.table_id] = { on: true, price: toRupiah(row.price_cents) };
    }

    return out;
  }, [query.data]);

  const current = draft ?? server;
  const attachedCount = Object.values(current).filter((d) => d.on).length;

  const grouped = useMemo(() => {
    const order = new Map<string, number>(
      sections.map((s: FloorSection, i: number) => [s.name, i]),
    );

    return [...tables]
      .filter((t) => t.status === "active")
      .sort((a, b) => {
        const sa = order.get(a.section ?? "") ?? 999;
        const sb = order.get(b.section ?? "") ?? 999;

        return sa !== sb ? sa - sb : a.name.localeCompare(b.name);
      })
      .reduce<Record<string, Table[]>>((acc, t) => {
        const key = (t.section ?? "").trim() || "Unassigned";
        (acc[key] ??= []).push(t);

        return acc;
      }, {});
  }, [tables, sections]);

  function patch(id: string, next: Partial<{ on: boolean; price: string }>) {
    setDraft((d) => {
      const base = d ?? server;
      const existing = base[id] ?? { on: false, price: "" };

      return { ...base, [id]: { ...existing, ...next } };
    });
  }

  function commit() {
    const rows: EventTablePayloadRow[] = Object.entries(current)
      .filter(([, d]) => d.on)
      .map(([table_id, d]) => ({ table_id, price_cents: toCents(d.price) }));

    save
      .mutateAsync(rows)
      .then(() => {
        setDraft(null);
        toast.success(
          rows.length === 0 ? "Tables detached" : `${rows.length} tables attached`,
        );
      })
      .catch((e) =>
        toast.error("Could not save", e instanceof ApiError ? e.message : undefined),
      );
  }

  if (query.isPending) {
    return <Skeleton className="mt-4 h-72 w-full" />;
  }

  if (query.isError) {
    return (
      <Card className="mt-4 p-6">
        <p className="text-sm text-destructive">
          {query.error instanceof ApiError
            ? query.error.message
            : "Unable to load tables for this event."}
        </p>
      </Card>
    );
  }

  const { venue_map_enabled: mapOn, gateway_ready: gatewayReady } = query.data;

  return (
    <div className="mt-4 space-y-4">
      <Card className="p-6">
        <h2 className="text-sm font-semibold">Tables for this event</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tick the tables this event uses, and give any of them a price for the night.
          Leave a price blank to attach a table at its normal price. Anything you
          don&apos;t tick is unaffected and books as usual.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {eventHasEndTime
            ? "The price applies only to bookings that start while the event is running — lunch on the same date is unchanged."
            : "This event has no end time, so pricing applies for 6 hours from its start."}
        </p>
      </Card>

      {!mapOn && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" aria-hidden />
          This venue doesn&apos;t have the venue map, so guests never choose a table and
          a price here could never be charged. Saving is disabled.
        </p>
      )}

      {/* Note the explicit {" "} before the em dash below. In this toolchain a
          text node that FOLLOWS an element loses its leading space, and a JSX
          comment placed mid-sentence does the same to the text after it — keep
          commentary outside the prose. */}
      {mapOn && !gatewayReady && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" aria-hidden />
          No payment gateway is connected. Pricing a table that is currently free will
          make it <span className="font-medium">unbookable</span>{" "}
          — the booking engine refuses to give away a priced table it can&apos;t charge
          for. Connect a gateway in Settings first.
        </p>
      )}

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {attachedCount === 0
              ? "No tables attached yet."
              : `${attachedCount} attached.`}
          </p>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="bulk-price">
                Set price for all ticked (IDR)
              </Label>
              <Input
                id="bulk-price"
                className="h-9 w-[180px]"
                inputMode="numeric"
                placeholder="e.g. 500000"
                value={bulk}
                onChange={(e) => setBulk(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={attachedCount === 0}
              onClick={() =>
                setDraft(() => {
                  const base = draft ?? server;
                  const next: Draft = { ...base };

                  for (const [id, d] of Object.entries(next)) {
                    if (d.on) next[id] = { ...d, price: bulk };
                  }

                  return next;
                })
              }
            >
              Apply
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-6">
          {Object.entries(grouped).map(([section, rows]) => (
            <div key={section}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {section}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setDraft(() => {
                      const base = draft ?? server;
                      const allOn = rows.every((t) => base[t.id]?.on);
                      const next: Draft = { ...base };

                      for (const t of rows) {
                        const existing = next[t.id] ?? { on: false, price: "" };
                        next[t.id] = { ...existing, on: !allOn };
                      }

                      return next;
                    })
                  }
                >
                  {rows.every((t) => current[t.id]?.on) ? "Clear section" : "Select all"}
                </Button>
              </div>

              <ul className="mt-2 space-y-2">
                {rows.map((t) => {
                  const d = current[t.id] ?? { on: false, price: "" };
                  const base = t.price_cents;

                  return (
                    <li
                      key={t.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 rounded-lg border p-3",
                        d.on ? "border-foreground/30 bg-muted/40" : "border-border",
                      )}
                    >
                      <input
                        id={`et-${t.id}`}
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--color-foreground)]"
                        checked={d.on}
                        onChange={(e) => patch(t.id, { on: e.target.checked })}
                      />
                      <Label htmlFor={`et-${t.id}`} className="flex-1 cursor-pointer">
                        <span className="text-sm font-medium">{t.name}</span>
                        <Badge variant="muted" className="ml-2">
                          <Users className="mr-1 h-3 w-3" />
                          {t.min_capacity}–{t.max_capacity}
                        </Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {base != null
                            ? `normally ${formatMoney(base, "IDR")}`
                            : "no standing price"}
                        </span>
                      </Label>
                      <Input
                        className="h-9 w-[150px]"
                        inputMode="numeric"
                        placeholder="Normal price"
                        aria-label={`Event price for ${t.name} in IDR`}
                        disabled={!d.on}
                        value={d.price}
                        onChange={(e) =>
                          patch(t.id, { price: e.target.value.replace(/[^\d]/g, "") })
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {tables.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            This venue has no active tables yet.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button disabled={!mapOn || save.isPending} onClick={commit}>
          {save.isPending ? "Saving…" : "Save tables"}
        </Button>
        <Button
          variant="outline"
          disabled={save.isPending || draft === null}
          onClick={() => setDraft(null)}
        >
          Reset
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Changing a price here does not change bookings already taken — each booking
        keeps the price it was quoted.
      </p>
    </div>
  );
}
