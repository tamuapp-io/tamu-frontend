"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Plus, Search, Trash2 } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiStat } from "@/components/kpi-stat";
import { FloorPlanPreview } from "@/components/floor-plan-preview";
import { TableEditSheet } from "@/components/table-edit-sheet";
import { ManageSectionsDialog } from "@/components/manage-sections-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTablesList, useDeleteTable, useFloorSections } from "@/lib/hooks/use-tables";
import type { Table } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";

const SHAPE_GLYPH: Record<string, { icon: string; rounded: string }> = {
  round: { icon: "●", rounded: "rounded-full" },
  rectangle: { icon: "▭", rounded: "rounded-sm" },
  booth: { icon: "■", rounded: "rounded-md" },
};

export default function TablesPage() {
  const { data: tables = [], isPending } = useTablesList({ per_page: 200 });
  const { data: floorSections = [] } = useFloorSections();
  const deleteTable = useDeleteTable();

  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [manageSectionsOpen, setManageSectionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Table | null>(null);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const stats = useMemo(() => {
    const active = tables.filter((t) => t.status === "active");
    const inactive = tables.filter((t) => t.status !== "active");

    const bySection = new Map<string, Table[]>();
    for (const t of tables) {
      const k = (t.section || "Other").toLowerCase();
      bySection.set(k, [...(bySection.get(k) ?? []), t]);
    }

    const totalCovers = active.reduce((sum, t) => sum + t.max_capacity, 0);
    const indoor = bySection.get("indoor") ?? [];
    const outdoor = bySection.get("outdoor") ?? [];
    const other = tables.filter(
      (t) => !["indoor", "outdoor"].includes((t.section || "").toLowerCase()),
    );

    return {
      total: tables.length,
      active: active.length,
      inactive: inactive.length,
      totalCovers,
      indoor: {
        count: indoor.length,
        covers: indoor.reduce((s, t) => s + t.max_capacity, 0),
      },
      outdoor: {
        count: outdoor.length,
        covers: outdoor.reduce((s, t) => s + t.max_capacity, 0),
      },
      other: {
        count: other.length,
        covers: other.reduce((s, t) => s + t.max_capacity, 0),
      },
    };
  }, [tables]);

  // Managed sections first (in their configured order), then any legacy
  // section names still present on tables but not in the managed list.
  const sections = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const s of floorSections) {
      if (!seen.has(s.name)) {
        ordered.push(s.name);
        seen.add(s.name);
      }
    }
    for (const t of tables) {
      if (t.section && !seen.has(t.section)) {
        ordered.push(t.section);
        seen.add(t.section);
      }
    }
    return ordered;
  }, [floorSections, tables]);

  const filtered = useMemo(() => {
    return tables.filter((t) => {
      if (sectionFilter !== "all" && t.section !== sectionFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !t.name.toLowerCase().includes(q) &&
          !(t.section ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tables, search, sectionFilter, statusFilter]);

  const startEdit = (table: Table | null) => {
    setEditingTable(table);
    setEditOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTable.mutateAsync(confirmDelete.id);
      toast.success("Table deactivated", confirmDelete.name);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not deactivate table";
      toast.error("Delete failed", msg);
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { label: "Manage" },
          { label: "Tables & Floor", current: true },
        ]}
        primaryAction={{
          label: "Add table",
          onClick: () => startEdit(null),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tables &amp; Floor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats.total} tables · {sections.length || 0} sections ·{" "}
              {stats.totalCovers} max covers
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiStat
            label="Total tables"
            value={stats.total}
            description={`${stats.active} active · ${stats.inactive} inactive`}
            loading={isPending}
          />
          <KpiStat
            label="Indoor"
            value={stats.indoor.count}
            description={`${stats.indoor.covers} max covers`}
            loading={isPending}
          />
          <KpiStat
            label="Outdoor"
            value={stats.outdoor.count}
            description={`${stats.outdoor.covers} max covers`}
            loading={isPending}
          />
          <KpiStat
            label="Bar &amp; Private"
            value={stats.other.count}
            description={`${stats.other.covers} max covers`}
            loading={isPending}
          />
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">Tables</TabsTrigger>
            <TabsTrigger value="floor">Floor plan</TabsTrigger>
            <TabsTrigger value="hours" disabled>
              Hours <span className="ml-2 rounded bg-muted px-1 py-0.5 text-[10px]">P2</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {/* filter bar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 p-3">
                <div className="relative w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or section"
                    className="h-9 pl-9"
                  />
                </div>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="md"
                  className="ml-auto"
                  onClick={() => setManageSectionsOpen(true)}
                >
                  <LayoutGrid className="h-4 w-4" /> Manage sections
                </Button>
              </div>

              <div className="grid grid-cols-[80px_1fr_120px_100px_84px_70px_80px] items-center gap-3 border-b border-border bg-muted/20 px-4 py-3 label-cap">
                <span>Name</span>
                <span>Capacity</span>
                <span>Section</span>
                <span>Shape</span>
                <span>Online</span>
                <span>Status</span>
                <span />
              </div>

              {isPending ? (
                <ListSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    {tables.length === 0
                      ? "No tables yet — add your first table to get started."
                      : "No tables match these filters."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(null)}
                  >
                    <Plus className="h-4 w-4" /> Add table
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {filtered.map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[80px_1fr_120px_100px_84px_70px_80px] items-center gap-3 px-4 py-3 hover:bg-muted/40"
                    >
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="text-left font-semibold hover:underline"
                      >
                        {t.name}
                      </button>
                      <span className="text-muted-foreground tabular-nums">
                        {t.min_capacity} – {t.max_capacity} ppl
                      </span>
                      <span>{t.section || "—"}</span>
                      <span className="inline-flex items-center gap-1.5 capitalize">
                        <span
                          className={cn(
                            "inline-block h-3 w-3 border border-slate-400",
                            SHAPE_GLYPH[t.shape]?.rounded ?? "rounded-sm",
                          )}
                        />
                        {t.shape}
                      </span>
                      <Switch
                        checked={t.online_bookable}
                        onCheckedChange={() => undefined}
                        disabled
                        aria-label="Online bookable (read-only here)"
                      />
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[12px] font-medium capitalize",
                          t.status === "active"
                            ? "text-emerald-700"
                            : t.status === "maintenance"
                              ? "text-amber-700"
                              : "text-slate-500",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            t.status === "active"
                              ? "bg-emerald-500"
                              : t.status === "maintenance"
                                ? "bg-amber-500"
                                : "bg-slate-400",
                          )}
                        />
                        {t.status}
                      </span>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(t)}
                        >
                          Edit
                        </Button>
                        {t.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Deactivate"
                            onClick={() => setConfirmDelete(t)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>

          <TabsContent value="floor" className="mt-4">
            <FloorPlanPreview tables={tables} interactive onTableClick={startEdit} />
          </TabsContent>
        </Tabs>
      </main>

      <TableEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        table={editingTable}
        sections={floorSections.map((s) => s.name)}
      />

      <ManageSectionsDialog
        open={manageSectionsOpen}
        onOpenChange={setManageSectionsOpen}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this table?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} will stop appearing in availability and the
              floor plan, but its history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(null)}>
              Keep
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant="destructive">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[80px_1fr_120px_100px_84px_70px_80px] items-center gap-3 px-4 py-3"
        >
          <div className="h-4 w-10 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-10 animate-pulse rounded bg-muted" />
          <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}
