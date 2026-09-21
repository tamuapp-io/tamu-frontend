"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { fetchSettings, patchSettings } from "@/lib/api/settings";
import {
  bookingCharge,
  chargeTypeLabel,
  depositCentsFromValue,
  type BookingChargeConfig,
  type BookingChargeType,
  type BookingDepositMode,
} from "@/lib/booking-charge";
import { formatMoney } from "@/lib/format";
import { useHasFeature } from "@/lib/hooks/use-features";
import {
  useFloorSections,
  useFloorSectionMutations,
  useTablesList,
  useUpdateTable,
} from "@/lib/hooks/use-tables";
import { cn } from "@/lib/utils";
import type { FloorSection, Table } from "@/lib/types";

/**
 * Prices and minimum spends, per section and per table, plus what share of them
 * a guest pays online.
 *
 * The amounts themselves are not new — `tables.price_cents` falling back to
 * `floor_sections.default_price_cents` has always driven the deposit. Until now
 * they could only be reached one at a time inside the venue-map editor, which
 * made a venue's pricing impossible to see as a whole. This is that whole.
 */

/** Whole rupiah in the field; TRUE cents (×100) on the wire, as the API expects. */
function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : String(Math.round(cents / 100));
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const rupiah = Number(trimmed);
  if (!Number.isFinite(rupiah) || rupiah < 0) return null;
  return Math.round(rupiah) * 100;
}

/**
 * An amount field that commits on blur rather than per keystroke.
 *
 * Saving as you type would fire a PATCH for "2", "20", "200" on the way to
 * 200,000 — four writes, three of them prices the venue never meant, any of
 * which a guest could book against in between.
 */
function AmountField({
  id,
  label,
  valueCents,
  placeholder,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  valueCents: number | null | undefined;
  placeholder: string;
  disabled?: boolean;
  onCommit: (cents: number | null) => void;
}) {
  const committed = centsToInput(valueCents);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? committed;

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <span className="text-xs text-muted-foreground">Rp</span>
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        className="h-9 w-36 text-right tabular-nums"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === null) return;
          const cents = inputToCents(draft);
          setDraft(null);
          if (cents !== (valueCents ?? null)) onCommit(cents);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

function SectionBlock({
  section,
  tables,
  charge,
  disabled,
  onSection,
  onTable,
}: {
  section: FloorSection;
  tables: Table[];
  charge: BookingChargeConfig;
  disabled?: boolean;
  onSection: (cents: number | null) => void;
  onTable: (table: Table, cents: number | null) => void;
}) {
  const fallback = section.default_price_cents ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{section.name}</h3>
          <p className="text-xs text-muted-foreground">
            Applies to every table here that has no amount of its own.
          </p>
        </div>
        <AmountField
          id={`section-${section.id}`}
          label={`${section.name} default amount`}
          valueCents={fallback}
          placeholder="None"
          disabled={disabled}
          onCommit={onSection}
        />
      </div>

      {tables.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground">No tables in this area yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tables.map((t) => {
            const own = t.price_cents ?? null;
            const effective = own ?? fallback ?? 0;
            const now = depositCentsFromValue(effective, charge);

            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Seats {t.min_capacity}–{t.max_capacity}
                    {own == null && fallback != null && " · inherits this area"}
                  </p>
                </div>

                <p className="w-40 text-right text-xs text-muted-foreground">
                  {effective > 0 ? (
                    <>
                      {formatMoney(effective, "IDR")}
                      {now !== effective && (
                        <span className="block">
                          {formatMoney(now, "IDR")} online
                        </span>
                      )}
                    </>
                  ) : (
                    "Free to book"
                  )}
                </p>

                <AmountField
                  id={`table-${t.id}`}
                  label={`${t.name} amount`}
                  valueCents={own}
                  placeholder={fallback == null ? "None" : centsToInput(fallback)}
                  disabled={disabled}
                  onCommit={(cents) => onTable(t, cents)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TablePricingTab() {
  const qc = useQueryClient();
  const hasVenueMap = useHasFeature("venue_map");

  const sections = useFloorSections();
  // Every table, not a page of them: this screen's whole job is the full
  // picture, and a paginated one would hide the table someone came to price.
  const tables = useTablesList({ per_page: 500 });
  const settings = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => fetchSettings().then((r) => r.data),
  });

  const sectionMutations = useFloorSectionMutations();
  const updateTable = useUpdateTable();

  const saveCharge = useMutation({
    mutationFn: (patch: Record<string, unknown>) => patchSettings({ booking: patch }),
    onSuccess: () => {
      toast.success("Charge settings saved");
      void qc.invalidateQueries({ queryKey: ["tenant-settings"] });
    },
    onError: (e) =>
      toast.error(
        "Could not save charge settings",
        e instanceof ApiError ? e.message : undefined,
      ),
  });

  const charge = bookingCharge(
    (settings.data?.settings?.booking ?? {}) as Record<string, unknown>,
  );

  const rows = useMemo(() => {
    const all: Table[] = tables.data ?? [];
    return (sections.data ?? []).map((section) => ({
      section,
      // Tables carry their area as a name, not an id — matching how the rest of
      // the app groups them.
      tables: all.filter((t) => t.section === section.name),
    }));
  }, [sections.data, tables.data]);

  if (sections.isPending || tables.isPending || settings.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  const busy =
    saveCharge.isPending || sectionMutations.update.isPending || updateTable.isPending;

  const exampleCents = 2_000_000_00;

  return (
    <div className="space-y-4">
      {!hasVenueMap && (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Amounts set here are saved, but nothing is charged for them until the
            venue map is switched on — guests can only be billed for a table they
            chose themselves, and without the map the engine assigns one for them.
          </p>
        </div>
      )}

      <Card className="overflow-hidden shadow-xs">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">What guests are charged</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Applies to every amount below.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-5 sm:grid-cols-2">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              These amounts are a
            </legend>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["table_fee", "Table fee", "Paid to book the table. Not redeemable against the bill."],
                  ["minimum_spend", "Minimum spend", "What the guest commits to spend. Anything paid now comes off their final bill."],
                ] as [BookingChargeType, string, string][]
              ).map(([value, title, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3",
                    charge.type === value ? "border-foreground/30 bg-muted/60" : "border-border",
                    busy && "pointer-events-none opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="charge-type"
                    className="mt-0.5"
                    checked={charge.type === value}
                    disabled={busy}
                    onChange={() => saveCharge.mutate({ charge_type: value })}
                  />
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Taken online
            </legend>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["full", "The full amount", "The guest settles everything up front."],
                  ["percent", "A percentage", "The rest is settled at the venue."],
                ] as [BookingDepositMode, string, string][]
              ).map(([value, title, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3",
                    charge.deposit_mode === value
                      ? "border-foreground/30 bg-muted/60"
                      : "border-border",
                    busy && "pointer-events-none opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="deposit-mode"
                    className="mt-0.5"
                    checked={charge.deposit_mode === value}
                    disabled={busy}
                    onChange={() =>
                      saveCharge.mutate(
                        value === "percent"
                          ? // The server refuses `percent` with no percentage, so
                            // switching carries a starting figure the venue edits.
                            { deposit_mode: value, deposit_percent: charge.deposit_percent === 100 ? 50 : charge.deposit_percent }
                          : { deposit_mode: value },
                      )
                    }
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>

                    {value === "percent" && charge.deposit_mode === "percent" && (
                      <span className="mt-2 flex items-center gap-2">
                        <Label htmlFor="deposit-percent" className="sr-only">
                          Percentage taken online
                        </Label>
                        <Input
                          id="deposit-percent"
                          inputMode="numeric"
                          defaultValue={String(charge.deposit_percent)}
                          disabled={busy}
                          className="h-9 w-20 text-right tabular-nums"
                          onBlur={(e) => {
                            const next = Math.round(Number(e.target.value));
                            if (!Number.isFinite(next) || next < 1 || next > 100) {
                              e.target.value = String(charge.deposit_percent);
                              return;
                            }
                            if (next !== charge.deposit_percent) {
                              saveCharge.mutate({ deposit_mode: "percent", deposit_percent: next });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                        />
                        <span className="text-sm text-muted-foreground">% now</span>
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <p className="border-t border-border bg-muted/10 px-6 py-3 text-xs text-muted-foreground">
          A {formatMoney(exampleCents, "IDR")} {chargeTypeLabel(charge.type).toLowerCase()} means
          the guest pays{" "}
          <span className="font-medium text-foreground">
            {formatMoney(depositCentsFromValue(exampleCents, charge), "IDR")}
          </span>{" "}
          when they book
          {charge.deposit_percent < 100 && (
            <>
              , and {formatMoney(exampleCents - depositCentsFromValue(exampleCents, charge), "IDR")}{" "}
              at the venue
            </>
          )}
          .
        </p>
      </Card>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Create a floor area first — amounts hang off areas and the tables in them.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ section, tables: sectionTables }) => (
            <SectionBlock
              key={section.id}
              section={section}
              tables={sectionTables}
              charge={charge}
              disabled={busy}
              onSection={(cents) =>
                sectionMutations.update.mutate({ id: section.id, default_price_cents: cents })
              }
              onTable={(table, cents) =>
                updateTable.mutate({ id: table.id, payload: { price_cents: cents } })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
