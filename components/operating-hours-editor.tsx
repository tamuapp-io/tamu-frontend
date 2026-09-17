"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api/client";
import type { OperatingHourRow } from "@/lib/types";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type HoursDraftRow = {
  key: string;
  day_of_week: number;
  period_name: string;
  open_time: string;
  close_time: string;
  slot_duration: number;
  turn_buffer: number;
  max_covers: string;
  is_closed: boolean;
};

let hoursRowCounter = 0;

export function apiRowToDraft(r: OperatingHourRow, i: number): HoursDraftRow {
  const ot = r.open_time ?? "";
  const ct = r.close_time ?? "";

  return {
    key: r.id || `srv-${i}`,
    day_of_week: r.day_of_week,
    period_name: r.period_name,
    open_time: ot.length >= 8 ? ot.slice(0, 5) : ot,
    close_time: ct.length >= 8 ? ct.slice(0, 5) : ct,
    slot_duration: r.slot_duration,
    turn_buffer: r.turn_buffer,
    max_covers: r.max_covers != null ? String(r.max_covers) : "",
    is_closed: r.is_closed,
  };
}

export function defaultHoursRow(): HoursDraftRow {
  hoursRowCounter += 1;

  return {
    key: `new-${hoursRowCounter}`,
    day_of_week: 1,
    period_name: "Dinner",
    open_time: "18:00",
    close_time: "22:00",
    slot_duration: 30,
    turn_buffer: 15,
    max_covers: "",
    is_closed: false,
  };
}

/** A fresh copy of another scope's rows — new keys, so React treats them as new. */
export function cloneDraft(rows: HoursDraftRow[]): HoursDraftRow[] {
  return rows.map((r) => {
    hoursRowCounter += 1;

    return { ...r, key: `copy-${hoursRowCounter}` };
  });
}

export function serializeHoursDraft(rows: HoursDraftRow[]) {
  return {
    periods: rows.map((r) => ({
      day_of_week: r.day_of_week,
      period_name: r.period_name.trim() || "Service",
      open_time: r.is_closed ? null : r.open_time.trim(),
      close_time: r.is_closed ? null : r.close_time.trim(),
      slot_duration: Math.min(180, Math.max(5, Number(r.slot_duration) || 30)),
      turn_buffer: Math.min(240, Math.max(0, Number(r.turn_buffer) || 0)),
      max_covers: (() => {
        const t = r.max_covers.trim();
        if (t === "") return null;
        const n = Number.parseInt(t, 10);
        return Number.isFinite(n) ? n : null;
      })(),
      is_closed: r.is_closed,
    })),
  };
}

/**
 * The opening-hours editor, shared by Settings (the venue's hours) and
 * Tables & Floor (an area's own).
 *
 * Presentational on purpose — it owns no query and no mutation, so each host
 * keeps its own and the two can't fight over cache invalidation.
 *
 * `showAdvanced` hides slot step, turn buffer and max covers for a section.
 * Those three are venue-wide by design: slot length is resolved before any table
 * — so before any area — is known, and a cover cap counts every reservation in
 * the building, so a per-area one would double count. The server overwrites them
 * on section rows regardless; hiding them keeps the UI honest about that.
 */
export function OperatingHoursEditor({
  timezone,
  rows,
  onChange,
  onSave,
  onReset,
  saving,
  error,
  showAdvanced = true,
  title = "Opening hours & slots",
  hint,
  saveLabel = "Save hours & slots",
  minRows = 1,
  footer,
}: {
  timezone: string;
  rows: HoursDraftRow[];
  onChange: Dispatch<SetStateAction<HoursDraftRow[] | null>>;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  error: unknown;
  showAdvanced?: boolean;
  title?: string;
  hint?: ReactNode;
  saveLabel?: string;
  /** A section may legitimately drop to zero periods; the venue may not. */
  minRows?: number;
  footer?: ReactNode;
}) {
  const patch = (idx: number, next: Partial<HoursDraftRow>) =>
    onChange((prev) => prev?.map((r, i) => (i === idx ? { ...r, ...next } : r)) ?? prev);

  const message =
    error instanceof ApiError && !error.errors && typeof error.message === "string"
      ? error.message
      : null;

  return (
    <Card className="overflow-hidden shadow-xs">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {hint ?? (
            <>
              Times follow your venue timezone ({timezone}). Slot step is the interval
              between bookable start times; turn buffer is spacing between parties.
            </>
          )}
        </p>
      </div>

      <div className="space-y-4 p-6">
        {message && (
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
        )}

        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No periods yet. Add one below.
          </p>
        )}

        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div
              key={row.key}
              className="space-y-3 rounded-lg border border-border bg-muted/10 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">
                  Period {idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  disabled={rows.length <= minRows || saving}
                  onClick={() =>
                    onChange((prev) =>
                      prev && prev.length > minRows
                        ? prev.filter((_, i) => i !== idx)
                        : prev,
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remove period</span>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Day</Label>
                  <Select
                    value={String(row.day_of_week)}
                    onValueChange={(v) => patch(idx, { day_of_week: Number(v) })}
                    disabled={row.is_closed}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_LABELS.map((label, dow) => (
                        <SelectItem key={label} value={String(dow)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label className="text-xs">Period name</Label>
                  <Input
                    className="h-9"
                    value={row.period_name}
                    onChange={(e) => patch(idx, { period_name: e.target.value })}
                    placeholder="e.g. Lunch"
                    disabled={row.is_closed}
                  />
                </div>

                <div className="flex items-end gap-2 sm:col-span-2">
                  <div className="flex grow items-center justify-between rounded-md border border-border px-3 py-2">
                    <Label className="text-xs font-normal">Closed</Label>
                    <Switch
                      checked={row.is_closed}
                      onCheckedChange={(is_closed) => patch(idx, { is_closed })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Opens</Label>
                  <Input
                    className="h-9"
                    type="time"
                    value={row.open_time}
                    onChange={(e) => patch(idx, { open_time: e.target.value })}
                    disabled={row.is_closed}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Closes</Label>
                  <Input
                    className="h-9"
                    type="time"
                    value={row.close_time}
                    onChange={(e) => patch(idx, { close_time: e.target.value })}
                    disabled={row.is_closed}
                  />
                </div>

                {showAdvanced && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Slot step (min)</Label>
                      <Input
                        className="h-9"
                        type="number"
                        min={5}
                        max={180}
                        value={row.slot_duration || ""}
                        onChange={(e) =>
                          patch(idx, {
                            slot_duration: Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                        disabled={row.is_closed}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Turn buffer (min)</Label>
                      <Input
                        className="h-9"
                        type="number"
                        min={0}
                        max={240}
                        value={row.turn_buffer}
                        onChange={(e) =>
                          patch(idx, {
                            turn_buffer: Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                        disabled={row.is_closed}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">
                        Max covers / slot{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        className="h-9"
                        type="number"
                        min={1}
                        placeholder="No limit"
                        value={row.max_covers}
                        onChange={(e) => patch(idx, { max_covers: e.target.value })}
                        disabled={row.is_closed}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange((prev) => [...(prev ?? []), defaultHoursRow()])}
          disabled={saving}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add period
        </Button>

        {footer}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border bg-muted/10 px-6 py-4">
        <Button type="button" disabled={saving || rows.length < minRows} onClick={onSave}>
          {saving ? "Saving…" : saveLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onReset} disabled={saving}>
          Reset
        </Button>
      </div>
    </Card>
  );
}
