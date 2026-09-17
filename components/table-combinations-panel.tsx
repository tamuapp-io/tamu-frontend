"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import {
  useTableCombinationMutations,
  useTableCombinations,
} from "@/lib/hooks/use-tables";
import { cn } from "@/lib/utils";
import type { Table, TableCombination } from "@/lib/types";

/**
 * Manage the table groups a venue can seat large parties across.
 *
 * Groups are only used when NO single table is free, so they exist for the
 * party that would otherwise be turned away — a venue of 4-tops taking a
 * booking for 8.
 */
export function TableCombinationsPanel({
  tables,
  enabled,
}: {
  tables: Table[];
  /** The per-venue toggle. Groups stay visible when off, but nothing new seats. */
  enabled: boolean;
}) {
  const combinations = useTableCombinations();
  const { create, update, retire } = useTableCombinationMutations();
  const [creating, setCreating] = useState(false);

  const rows = combinations.data ?? [];

  return (
    <Card className="overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold">Table combinations</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Groups of tables that can be pushed together for one large party.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New group
        </Button>
      </div>

      {!enabled && (
        <p className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Table combinations are switched off for this venue, so nothing here is
          seated. Turn them on in Settings &rarr; Booking. Existing bookings on a
          group keep their tables either way.
        </p>
      )}

      <div className="p-6">
        {combinations.isPending && <Skeleton className="h-32 w-full" />}

        {combinations.isError && (
          <p className="text-sm text-destructive">
            {combinations.error instanceof ApiError
              ? combinations.error.message
              : "Unable to load table groups."}
          </p>
        )}

        {combinations.data && rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No groups yet. Create one to seat parties bigger than any single table.
          </p>
        )}

        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
                c.is_bookable ? "border-border" : "border-dashed border-border opacity-70",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <Badge variant="muted">
                    <Users className="mr-1 h-3 w-3" />
                    {c.effective_min_capacity}–{c.effective_max_capacity}
                  </Badge>
                  {!c.is_bookable && (
                    <Badge variant="muted" className="text-amber-700 dark:text-amber-200">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {c.blocked_reason}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {(c.tables ?? []).map((t) => t.name).join(" + ") || "No tables"}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                {c.is_active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={retire.isPending}
                    onClick={() =>
                      retire
                        .mutateAsync(c.id)
                        .then(() => toast.success(`${c.name} retired`))
                        .catch((e) =>
                          toast.error(
                            "Could not retire",
                            e instanceof ApiError ? e.message : undefined,
                          ),
                        )
                    }
                  >
                    <Trash2 className="h-4 w-4" /> Retire
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={update.isPending}
                    onClick={() =>
                      update
                        .mutateAsync({ id: c.id, payload: { is_active: true } })
                        .then(() => toast.success(`${c.name} is active again`))
                        .catch((e) =>
                          toast.error(
                            "Could not reactivate",
                            e instanceof ApiError ? e.message : undefined,
                          ),
                        )
                    }
                  >
                    <RotateCcw className="h-4 w-4" /> Reactivate
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <CreateCombinationDialog
        tables={tables}
        existing={rows}
        open={creating}
        onOpenChange={setCreating}
        onCreate={async (payload) => {
          try {
            await create.mutateAsync(payload);
            toast.success(`${payload.name} created`);
            setCreating(false);
          } catch (e) {
            toast.error("Could not create group", e instanceof ApiError ? e.message : undefined);
          }
        }}
        pending={create.isPending}
      />
    </Card>
  );
}

function CreateCombinationDialog({
  tables,
  existing,
  open,
  onOpenChange,
  onCreate,
  pending,
}: {
  tables: Table[];
  existing: TableCombination[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: { name: string; table_ids: string[]; max_capacity?: number }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [seats, setSeats] = useState("");

  const selectable = useMemo(
    () => tables.filter((t) => t.status === "active"),
    [tables],
  );

  const memberSum = useMemo(
    () =>
      ids.reduce((sum, id) => sum + (tables.find((t) => t.id === id)?.max_capacity ?? 0), 0),
    [ids, tables],
  );

  // Exact set equality, the same rule the server uses to resolve a selection.
  const duplicate = useMemo(() => {
    const wanted = [...ids].sort().join("|");
    return existing.find((c) => [...c.table_ids].sort().join("|") === wanted);
  }, [ids, existing]);

  const seatsNum = seats.trim() === "" ? null : Number(seats);
  const seatsTooBig = seatsNum !== null && seatsNum > memberSum;
  const canSave =
    name.trim().length > 0 && ids.length >= 2 && !duplicate && !seatsTooBig && !pending;

  function toggle(id: string) {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setName("");
      setIds([]);
      setSeats("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New table group</DialogTitle>
          <DialogDescription>
            Pick the tables that get pushed together. The group is only used when no
            single table is free.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tc-name">Name</Label>
            <Input
              id="tc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A+B"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tables</Label>
            <div className="flex flex-wrap gap-2">
              {selectable.map((t) => {
                const on = ids.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      on
                        ? "border-foreground/30 bg-muted font-medium"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    {t.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {t.max_capacity}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {ids.length < 2
                ? "Pick at least two tables."
                : `Seats up to ${memberSum} together.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tc-seats">Seats (optional)</Label>
            <Input
              id="tc-seats"
              inputMode="numeric"
              value={seats}
              onChange={(e) => setSeats(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={memberSum > 0 ? String(memberSum) : "Sum of the tables"}
              className="max-w-[160px]"
            />
            <p className="text-xs text-muted-foreground">
              Two 4-tops pushed together often seat 7, not 8. Leave blank to use the sum.
            </p>
          </div>

          {duplicate && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              Those exact tables are already the group{" "}
              <span className="font-medium">{duplicate.name}</span>.
            </p>
          )}
          {seatsTooBig && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              These tables seat at most {memberSum}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onCreate({
                name: name.trim(),
                table_ids: ids,
                ...(seatsNum !== null ? { max_capacity: seatsNum } : {}),
              })
            }
          >
            {pending ? "Creating…" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
