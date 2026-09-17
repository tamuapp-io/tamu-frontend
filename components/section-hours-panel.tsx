"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import {
  OperatingHoursEditor,
  apiRowToDraft,
  cloneDraft,
  serializeHoursDraft,
  type HoursDraftRow,
} from "@/components/operating-hours-editor";
import { ApiError } from "@/lib/api/client";
import { fetchOperatingHourScopes, syncOperatingHours } from "@/lib/api/settings";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import type { OperatingHourScopes } from "@/lib/types";

const VENUE = "venue";

/**
 * Hours for the whole venue, or for one area of it.
 *
 * An area that keeps its own hours REPLACES the venue week rather than merging
 * into it — a rooftop with "Friday dinner" is closed Monday to Thursday, which
 * is the point of saying so. That makes the Customize switch load-bearing: it
 * seeds from the venue week so an owner edits down from something real instead
 * of starting blank and silently shutting the area six days out of seven.
 */
export function SectionHoursPanel() {
  const timezone = useTenantTimezone();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["settings", "operating-hours"],
    queryFn: async () => (await fetchOperatingHourScopes()).data,
  });

  const [scope, setScope] = useState<string>(VENUE);
  // Per-scope drafts, so switching areas doesn't discard unsaved edits.
  const [drafts, setDrafts] = useState<Record<string, HoursDraftRow[] | null>>({});

  const data: OperatingHourScopes | undefined = query.data;
  const section = useMemo(
    () => data?.sections.find((s) => s.id === scope) ?? null,
    [data, scope],
  );

  const serverRows = useMemo(
    () => (scope === VENUE ? (data?.venue ?? []) : (section?.periods ?? [])),
    [scope, data, section],
  );

  // Derived, not synced through an effect: the draft is whatever has been typed
  // for this scope, else whatever the server last said.
  const rows = drafts[scope] ?? serverRows.map(apiRowToDraft);
  const customised = scope === VENUE || section?.has_custom_hours === true;
  // Includes an unsaved draft, so the switch stays on while the owner is still
  // editing the week it seeded for them.
  const ownHours = customised || drafts[scope] != null;

  const save = useMutation({
    mutationFn: (payload: { floor_section_id?: string | null; rows: HoursDraftRow[] }) =>
      syncOperatingHours({
        floor_section_id: payload.floor_section_id ?? null,
        ...serializeHoursDraft(payload.rows),
      }),
    onSuccess: async (_res, vars) => {
      setDrafts((d) => ({ ...d, [vars.floor_section_id ?? VENUE]: null }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "operating-hours"] }),
        // The venue snapshot carries operating_hours too, and the availability
        // grid everyone is looking at is now stale.
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ]);
    },
  });

  function setRows(next: React.SetStateAction<HoursDraftRow[] | null>) {
    setDrafts((d) => ({
      ...d,
      [scope]: typeof next === "function" ? next(d[scope] ?? rows) : next,
    }));
  }

  function commit(nextRows: HoursDraftRow[]) {
    save
      .mutateAsync({ floor_section_id: scope === VENUE ? null : scope, rows: nextRows })
      .then(() =>
        toast.success(
          scope === VENUE ? "Venue hours saved" : `${section?.name} hours saved`,
        ),
      )
      .catch((e) =>
        toast.error("Could not save hours", e instanceof ApiError ? e.message : undefined),
      );
  }

  /** Switch this area on (seeded from the venue week) or back to the venue's. */
  function toggleCustom(on: boolean) {
    if (on) {
      setDrafts((d) => ({ ...d, [scope]: cloneDraft((data?.venue ?? []).map(apiRowToDraft)) }));

      return;
    }

    // An empty payload for a section drops its schedule; the server reads that
    // as "follow the venue again".
    commit([]);
  }

  if (query.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (query.isError || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">
          {query.error instanceof ApiError
            ? query.error.message
            : "Unable to load opening hours."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end justify-between gap-4 p-6">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="hours-scope">
            Hours for
          </Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="hours-scope" className="h-9 w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VENUE}>Whole venue</SelectItem>
              {data.sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.has_custom_hours ? " · own hours" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scope !== VENUE && (
          <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
            <div>
              <Label className="text-xs font-normal">Own opening hours</Label>
              <p className="text-[11px] text-muted-foreground">
                {ownHours
                  ? "On — this area keeps its own week"
                  : "Off — follows the whole venue"}
              </p>
            </div>
            <Switch
              checked={ownHours}
              disabled={save.isPending}
              onCheckedChange={toggleCustom}
            />
          </div>
        )}
      </Card>

      {scope !== VENUE && !customised && drafts[scope] == null ? (
        <Card className="p-8 text-center">
          <Clock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          {/* Explicit {" "} around each boundary: JSX drops the space between an
              element or expression and text that runs to the end of the line,
              which rendered this as "mainfollows the venue's hours". */}
          <p className="mt-3 text-sm font-medium">
            {section?.name}
            {" follows the venue’s hours"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Switch on <span className="font-medium">Own opening hours</span>{" "}
            to give this area its own week — for a rooftop that only opens for dinner at
            weekends, say. You&apos;ll start from a copy of the venue&apos;s hours.
          </p>
        </Card>
      ) : (
        <OperatingHoursEditor
          timezone={timezone || "UTC"}
          rows={rows}
          onChange={setRows}
          onSave={() => commit(rows)}
          onReset={() => setDrafts((d) => ({ ...d, [scope]: null }))}
          saving={save.isPending}
          error={save.error}
          // Slot step, turn buffer and cover caps stay venue-wide — the server
          // overwrites them on a section row, so showing them would be a lie.
          showAdvanced={scope === VENUE}
          minRows={scope === VENUE ? 1 : 0}
          title={scope === VENUE ? "Whole venue" : `${section?.name} hours`}
          saveLabel={scope === VENUE ? "Save venue hours" : `Save ${section?.name} hours`}
          hint={
            scope === VENUE ? undefined : (
              <>
                Times follow your venue timezone ({timezone || "UTC"}).{" "}
                <span className="font-medium text-foreground">
                  {`Any day you don’t list here is closed for ${section?.name ?? "this area"}`}
                </span>{" "}
                — the rest of the venue is unaffected.
              </>
            )
          }
        />
      )}
    </div>
  );
}
