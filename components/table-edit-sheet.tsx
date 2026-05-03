"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useCreateTable, useUpdateTable } from "@/lib/hooks/use-tables";
import type {
  CreateTablePayload,
  Table,
  TableShape,
  TableStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";

interface TableEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Table | null;
}

const SECTIONS = ["Indoor", "Outdoor", "Private", "Bar"];
const SHAPES: { value: TableShape; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "rectangle", label: "Rectangle" },
  { value: "booth", label: "Booth" },
];
const STATUSES: { value: TableStatus; label: string; tone: string }[] = [
  { value: "active", label: "Active", tone: "text-emerald-600" },
  { value: "inactive", label: "Inactive", tone: "text-slate-500" },
  { value: "maintenance", label: "Maintenance", tone: "text-amber-600" },
];

const initialForm: CreateTablePayload = {
  name: "",
  min_capacity: 2,
  max_capacity: 4,
  section: "Indoor",
  shape: "round",
  status: "active",
  online_bookable: true,
  priority: 5,
};

export function TableEditSheet({ open, onOpenChange, table }: TableEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[480px] p-0">
        <TableEditForm
          key={table?.id ?? "new"}
          table={table}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function TableEditForm({
  table,
  onClose,
}: {
  table: Table | null;
  onClose: () => void;
}) {
  const create = useCreateTable();
  const update = useUpdateTable();
  const [form, setForm] = useState<CreateTablePayload>(() =>
    table
      ? {
          name: table.name,
          min_capacity: table.min_capacity,
          max_capacity: table.max_capacity,
          section: table.section || "Indoor",
          shape: table.shape,
          status: table.status,
          online_bookable: table.online_bookable,
          priority: table.priority,
        }
      : initialForm,
  );

  const isEdit = !!table;
  const mutation = isEdit ? update : create;
  const fieldErrors =
    (mutation.error instanceof ApiError && mutation.error.errors) || {};
  const formError =
    mutation.error instanceof ApiError && !mutation.error.errors
      ? mutation.error.message
      : null;

  function set<K extends keyof CreateTablePayload>(
    key: K,
    value: CreateTablePayload[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const localValid = form.max_capacity >= form.min_capacity && form.name.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!localValid) return;
    try {
      if (isEdit && table) {
        await update.mutateAsync({ id: table.id, payload: form });
        toast.success("Table updated", form.name);
      } else {
        await create.mutateAsync(form);
        toast.success("Table created", form.name);
      }
      onClose();
    } catch {
      // shown inline
    }
  }

  return (
    <>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Edit ${table.name}` : "Add table"}</SheetTitle>
          <SheetDescription>
            Capacity, section, shape, and online availability. Changes apply to
            future bookings only.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Name</Label>
            <Input
              id="t-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="T7"
              maxLength={60}
              required
              invalid={!!fieldErrors.name}
            />
            {fieldErrors.name?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-min">Min capacity</Label>
              <Input
                id="t-min"
                type="number"
                min={1}
                max={50}
                value={form.min_capacity}
                onChange={(e) => set("min_capacity", Number(e.target.value))}
                invalid={!!fieldErrors.min_capacity}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-max">Max capacity</Label>
              <Input
                id="t-max"
                type="number"
                min={1}
                max={50}
                value={form.max_capacity}
                onChange={(e) => set("max_capacity", Number(e.target.value))}
                invalid={!!fieldErrors.max_capacity || form.max_capacity < form.min_capacity}
              />
              {form.max_capacity < form.min_capacity && (
                <p className="text-xs text-destructive">Max must be ≥ min.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Section</Label>
            <div className="inline-flex flex-wrap rounded-lg bg-muted p-1">
              {SECTIONS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => set("section", s)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    form.section?.toLowerCase() === s.toLowerCase()
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Shape</Label>
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => set("shape", s.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm transition-colors",
                    form.shape === s.value &&
                      "border-foreground bg-muted ring-1 ring-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-6 w-8 border-2 border-foreground/40",
                      s.value === "round" && "h-6 w-6 rounded-full",
                      s.value === "rectangle" && "rounded-sm",
                      s.value === "booth" && "rounded-md",
                    )}
                    aria-hidden
                  />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <Label htmlFor="t-online" className="text-sm font-medium">
                Online bookable
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow guests to reserve this table from the public booking page.
              </p>
            </div>
            <Switch
              id="t-online"
              checked={form.online_bookable ?? true}
              onCheckedChange={(v) => set("online_bookable", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-priority">Priority (1–10)</Label>
            <div className="flex items-center gap-3">
              <input
                id="t-priority"
                type="range"
                min={1}
                max={10}
                value={form.priority ?? 5}
                onChange={(e) => set("priority", Number(e.target.value))}
                className="flex-1 accent-foreground"
              />
              <span className="w-8 text-sm font-semibold tabular-nums">
                {form.priority ?? 5}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Lower number = filled first.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => set("status", s.value)}
                  className={cn(
                    "rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors",
                    form.status === s.value &&
                      "border-foreground ring-1 ring-foreground",
                  )}
                >
                  <span className={cn("font-medium", s.tone)}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}
        </form>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!localValid || mutation.isPending}
          >
            {mutation.isPending
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Create table"}
          </Button>
        </SheetFooter>
    </>
  );
}
