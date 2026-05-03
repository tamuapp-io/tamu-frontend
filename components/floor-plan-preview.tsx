"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Reservation, Table } from "@/lib/types";
import { useUpdateTablePositions } from "@/lib/hooks/use-tables";
import { toast } from "@/components/ui/toaster";
import { instantFromApi } from "@/lib/format";
import { Loader2 } from "lucide-react";

interface FloorPlanPreviewProps {
  tables: Table[];
  reservations?: Reservation[];
  now?: Date;
  onTableClick?: (table: Table) => void;
  /** Section list (legacy) vs positioned canvas from stored coordinates. */
  layout?: "sections" | "canvas";
  /** When true, tables can be dragged; positions persist via API. */
  interactive?: boolean;
}

const GRID_GAP_SECTIONS = 8;
const FLOOR_COLS = 8;
const FLOOR_STEP = 96;
const CANVAS_PAD = 48;
const DRAG_THRESHOLD_PX = 6;

type TableState = "available" | "reserved" | "seated" | "attention" | "inactive";

export function tablesStackedAtOrigin(tables: Table[]): boolean {
  if (tables.length < 2) return false;
  return tables.every(
    (t) => Math.abs(t.position.x) < 0.5 && Math.abs(t.position.y) < 0.5,
  );
}

function compareTables(a: Table, b: Table): number {
  const sec = (a.section || "").localeCompare(b.section || "");
  if (sec !== 0) return sec;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.name.localeCompare(b.name);
}

export type FloorLayoutCell = {
  table: Table;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
};

function tableIsDraggable(t: Table): boolean {
  return t.status === "active" || t.status === "maintenance";
}

/** Display + persist coordinates: virtual grid when everyone is still at (0,0), else API values. */
export function floorLayoutCells(tables: Table[]): FloorLayoutCell[] {
  const sorted = [...tables].sort(compareTables);
  const stacked = tablesStackedAtOrigin(sorted);

  return sorted.map((table, index) => {
    const w = Math.max(48, table.position.width || 80);
    const h = Math.max(48, table.position.height || 80);
    const rotation = table.position.rotation ?? 0;
    let x = table.position.x;
    let y = table.position.y;

    if (stacked) {
      const col = index % FLOOR_COLS;
      const row = Math.floor(index / FLOOR_COLS);
      x = col * FLOOR_STEP;
      y = row * FLOOR_STEP;
    }

    return { table, x, y, w, h, rotation };
  });
}

function cellsToPayload(cells: FloorLayoutCell[]): Array<{
  id: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  rotation: number;
}> {
  return cells.map(({ table, x, y, w, h, rotation }) => ({
    id: table.id,
    pos_x: x,
    pos_y: y,
    width: w,
    height: h,
    rotation,
  }));
}

function deriveState(
  table: Table,
  reservations: Reservation[],
  now: Date,
): TableState {
  if (table.status !== "active") return "inactive";

  const active = reservations.find((r) => {
    if (r.table_id !== table.id && !r.tables?.some((t) => t.id === table.id)) {
      return false;
    }
    return r.status === "seated";
  });
  if (active) return "seated";

  const upcoming = reservations.find((r) => {
    if (r.table_id !== table.id && !r.tables?.some((t) => t.id === table.id)) {
      return false;
    }
    if (r.status !== "confirmed" && r.status !== "pending") return false;
    const start = instantFromApi(r.reserved_at).getTime();
    const diffMin = (start - now.getTime()) / 60_000;
    return diffMin >= 0 && diffMin <= 90;
  });
  if (upcoming) return "reserved";

  return "available";
}

function canvasSize(cells: FloorLayoutCell[]) {
  if (cells.length === 0) return { width: 400, height: 280 };

  let maxR = CANVAS_PAD;
  let maxB = CANVAS_PAD;
  for (const c of cells) {
    maxR = Math.max(maxR, c.x + c.w + CANVAS_PAD);
    maxB = Math.max(maxB, c.y + c.h + CANVAS_PAD);
  }
  return {
    width: Math.max(400, maxR),
    height: Math.max(280, maxB),
  };
}

export function FloorPlanPreview({
  tables,
  reservations = [],
  now = new Date(),
  onTableClick,
  layout = "canvas",
  interactive = false,
}: FloorPlanPreviewProps) {
  const layoutCells = useMemo(() => floorLayoutCells(tables), [tables]);
  const { mutate: persistPositions, isPending: isSaving } = useUpdateTablePositions();

  const stackFingerprint = useMemo(() => {
    if (!interactive || !tablesStackedAtOrigin(tables)) return null;
    return tables
      .map((t) => t.id)
      .sort()
      .join(",");
  }, [interactive, tables]);

  const lastSeedFp = useRef<string | null>(null);

  useEffect(() => {
    if (!interactive) {
      lastSeedFp.current = null;
      return;
    }
    if (stackFingerprint === null) {
      lastSeedFp.current = null;
      return;
    }
    if (lastSeedFp.current === stackFingerprint || isSaving) return;

    lastSeedFp.current = stackFingerprint;
    const payload = cellsToPayload(floorLayoutCells(tables));

    persistPositions(payload, {
      onError: (err: unknown) => {
        if (lastSeedFp.current === stackFingerprint) lastSeedFp.current = null;
        const msg = err instanceof Error ? err.message : "Try again.";
        toast.error("Could not save floor layout", msg);
      },
    });
  }, [interactive, stackFingerprint, isSaving, tables, persistPositions]);

  const [dragDelta, setDragDelta] = useState<{ id: string; dx: number; dy: number } | null>(
    null,
  );
  const dragCtx = useRef<{
    id: string;
    startCx: number;
    startCy: number;
    moved: boolean;
  } | null>(null);

  const mergedCells = useMemo(() => {
    if (!dragDelta) return layoutCells;
    return layoutCells.map((c) =>
      c.table.id === dragDelta.id
        ? {
            ...c,
            x: Math.max(0, c.x + dragDelta.dx),
            y: Math.max(0, c.y + dragDelta.dy),
          }
        : c,
    );
  }, [layoutCells, dragDelta]);

  const dims = useMemo(() => canvasSize(mergedCells), [mergedCells]);

  if (tables.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Add a table to see the floor plan.
      </div>
    );
  }

  if (layout === "sections") {
    return (
      <FloorPlanSections
        tables={tables}
        reservations={reservations}
        now={now}
        onTableClick={onTableClick}
      />
    );
  }

  const endDrag = (e: PointerEvent | React.PointerEvent) => {
    const ctx = dragCtx.current;
    dragCtx.current = null;
    if (!interactive || !ctx) {
      setDragDelta(null);
      return;
    }

    const dx = e.clientX - ctx.startCx;
    const dy = e.clientY - ctx.startCy;
    setDragDelta(null);

    if (!ctx.moved) {
      const t = tables.find((x) => x.id === ctx.id);
      if (t) onTableClick?.(t);
      return;
    }

    const baseCells = layoutCells;
    const nextCells = baseCells.map((c) =>
      c.table.id === ctx.id
        ? { ...c, x: Math.max(0, c.x + dx), y: Math.max(0, c.y + dy) }
        : c,
    );

    persistPositions(cellsToPayload(nextCells), {
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Try again.";
        toast.error("Could not save position", msg);
      },
    });
  };

  const onTablePointerDown = (e: React.PointerEvent, id: string) => {
    if (!interactive || e.button !== 0) return;

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    dragCtx.current = {
      id,
      startCx: e.clientX,
      startCy: e.clientY,
      moved: false,
    };
    setDragDelta({ id, dx: 0, dy: 0 });

    const move = (ev: PointerEvent) => {
      if (!dragCtx.current || dragCtx.current.id !== id) return;
      const dx = ev.clientX - dragCtx.current.startCx;
      const dy = ev.clientY - dragCtx.current.startCy;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        dragCtx.current.moved = true;
      }
      setDragDelta({ id, dx, dy });
    };

    const up = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* capture may already be cleared */
      }
      endDrag(ev);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Floor plan</h3>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {interactive ? (
              <>
                Drag tables to arrange the room; layout saves when you drop.
                {isSaving ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…
                  </span>
                ) : null}
              </>
            ) : (
              "Live occupancy on your planned layout."
            )}
          </p>
        </div>
        <FloorLegend />
      </div>

      <div
        data-floor-canvas
        className={cn(
          "relative mx-auto overflow-auto rounded-lg border border-border bg-muted/25",
          interactive && "ring-2 ring-transparent focus-within:ring-ring",
        )}
        style={{ maxHeight: interactive ? "min(70vh, 640px)" : "min(55vh, 520px)" }}
      >
        <div className="relative" style={{ width: dims.width, height: dims.height }}>
          {/* subtle grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
              `,
              backgroundSize: "24px 24px",
            }}
          />
          {mergedCells.map((cell) => {
            const state = deriveState(cell.table, reservations, now);
            const draggable = interactive && tableIsDraggable(cell.table);
            return (
              <button
                key={cell.table.id}
                type="button"
                onPointerDown={(e) => {
                  if (interactive) {
                    if (!tableIsDraggable(cell.table)) {
                      return;
                    }
                    onTablePointerDown(e, cell.table.id);
                    return;
                  }
                }}
                onClick={
                  interactive && draggable
                    ? undefined
                    : () => onTableClick?.(cell.table)
                }
                aria-label={`${cell.table.name} · ${state}`}
                aria-grabbed={interactive && dragDelta?.id === cell.table.id ? true : undefined}
                className={cn(
                  "absolute flex select-none flex-col items-center justify-center gap-0.5 border-2 px-1 text-center text-foreground transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  draggable && "touch-none cursor-grab active:cursor-grabbing",
                  interactive && dragDelta?.id === cell.table.id && "z-10 shadow-lg",
                  cell.table.shape === "round" ? "rounded-full" : "rounded-lg",
                  interactive && !tableIsDraggable(cell.table) && "cursor-default opacity-70",
                  stateBg(state),
                  stateBorder(state),
                  stateText(state),
                )}
                style={{
                  left: 0,
                  top: 0,
                  width: cell.w,
                  height: cell.h,
                  transform: `translate(${cell.x}px, ${cell.y}px) rotate(${cell.rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight md:text-xs">
                  {cell.table.name}
                </span>
                <span className="text-[9px] tabular-nums opacity-75">
                  {cell.table.min_capacity}–{cell.table.max_capacity}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FloorPlanSections({
  tables,
  reservations = [],
  now = new Date(),
  onTableClick,
}: Omit<FloorPlanPreviewProps, "layout" | "interactive">) {
  const sections = useMemo(() => {
    const map = new Map<string, Table[]>();
    for (const t of tables) {
      const key = t.section || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    }));
  }, [tables]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Floor plan</h3>
          <p className="text-xs text-muted-foreground">Grouped by section (list view).</p>
        </div>
        <FloorLegend />
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.name}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {section.name}
              </span>
              <span className="text-xs text-muted-foreground">{section.items.length} tables</span>
            </div>
            <div className="flex flex-wrap" style={{ gap: GRID_GAP_SECTIONS }}>
              {section.items.map((t) => {
                const state = deriveState(t, reservations, now);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTableClick?.(t)}
                    aria-label={`${t.name} · ${state}`}
                    className={cn(
                      "flex select-none flex-col items-center justify-center gap-1 border-2 transition-shadow hover:shadow-md",
                      t.shape === "round" ? "rounded-full" : "rounded-lg",
                      stateBg(state),
                      stateBorder(state),
                      stateText(state),
                    )}
                    style={{ width: 80, height: 80 }}
                  >
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="text-[10px] tabular-nums opacity-70">
                      {t.min_capacity}–{t.max_capacity}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function stateBg(state: TableState) {
  switch (state) {
    case "available":
      return "bg-card";
    case "reserved":
      return "bg-blue-50 dark:bg-blue-950/30";
    case "seated":
      return "bg-emerald-50 dark:bg-emerald-950/30";
    case "attention":
      return "bg-rose-50 dark:bg-rose-950/30";
    case "inactive":
      return "bg-muted";
  }
}
function stateBorder(state: TableState) {
  switch (state) {
    case "available":
      return "border-border";
    case "reserved":
      return "border-blue-500";
    case "seated":
      return "border-emerald-500";
    case "attention":
      return "border-rose-500";
    case "inactive":
      return "border-muted-foreground/40";
  }
}
function stateText(state: TableState) {
  switch (state) {
    case "reserved":
      return "text-blue-900 dark:text-blue-200";
    case "seated":
      return "text-emerald-900 dark:text-emerald-200";
    case "attention":
      return "text-rose-900 dark:text-rose-200";
    case "inactive":
      return "text-muted-foreground";
    default:
      return "";
  }
}

function FloorLegend() {
  const items: Array<{ label: string; state: TableState }> = [
    { label: "Available", state: "available" },
    { label: "Reserved", state: "reserved" },
    { label: "Seated", state: "seated" },
    { label: "Inactive", state: "inactive" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-sm border",
              stateBg(i.state),
              stateBorder(i.state),
            )}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
