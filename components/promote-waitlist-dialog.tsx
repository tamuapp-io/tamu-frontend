"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableFloorPicker } from "@/components/table-floor-picker";
import { combinationCapacityError, matchAssignment } from "@/lib/combination-match";
import { useTableCombinations } from "@/lib/hooks/use-tables";
import { formatTimeInTz } from "@/lib/format";
import type { WaitlistEntryPublic } from "@/lib/types";

type WaitlistRow = WaitlistEntryPublic & { position: number };

/**
 * Seat a waiting party.
 *
 * The promote endpoint has accepted `table_id` and `combination_id` since it
 * was written, but the UI only ever sent `{}` — so every promotion went to
 * auto-assignment and staff could never say where. Leaving the picker empty
 * keeps exactly that behaviour, which is what makes this safe to add.
 */
export function PromoteWaitlistDialog({
  row,
  timeZone,
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  row: WaitlistRow | null;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: (body: { table_id?: string | null; combination_id?: string | null }) => void;
}) {
  const combinations = useTableCombinations();
  const [ids, setIds] = useState<string[]>([]);

  const match = matchAssignment(ids, combinations.data ?? []);
  const capacityError = combinationCapacityError(match, row?.party_size ?? 0);
  const blocked = match.kind === "none" || capacityError !== null;

  function handleOpenChange(next: boolean) {
    if (next) setIds([]);
    onOpenChange(next);
  }

  function confirm() {
    onConfirm(
      match.kind === "table"
        ? { table_id: match.table_id }
        : match.kind === "combination"
          ? { combination_id: match.combination_id }
          : {},
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Seat this party</DialogTitle>
          <DialogDescription>
            {row ? (
              <>
                {row.guest?.name ?? "Waiting party"} · {row.party_size} guests ·{" "}
                {formatTimeInTz(row.reserved_at, timeZone)}. Pick where they sit, or leave
                it blank to let the engine choose.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="space-y-2">
            <TableFloorPicker
              reservedAt={row.reserved_at}
              durationMins={row.duration_mins ?? 90}
              partySize={row.party_size}
              value={null}
              onChange={() => {}}
              mode="multi"
              selectedIds={ids}
              onChangeMulti={setIds}
              combinations={combinations.data ?? []}
            />

            {blocked && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                Those tables aren&apos;t a saved group. Create it in Tables &rarr;
                Combinations, or pick a single table.
              </p>
            )}
            {capacityError && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {capacityError}
              </p>
            )}
            {match.kind === "combination" && !capacityError && (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Seating on{" "}
                <span className="font-medium text-foreground">{match.combination.name}</span>{" "}
                · seats {match.combination.effective_max_capacity}.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={blocked || pending}>
            {pending
              ? "Seating…"
              : match.kind === "empty"
                ? "Auto-assign & seat"
                : "Seat here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
