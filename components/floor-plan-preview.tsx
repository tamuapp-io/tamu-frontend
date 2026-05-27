"use client";

import { useEffect, useMemo, useRef } from "react";
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

  // Drag is animated imperatively (DOM transform mutation, rAF-throttled) so
  // pointermove doesn't trigger React re-renders. With even ~20 tables on the
  // canvas, going through React state on every move was rendering all buttons
  // at 60–120Hz and pegging the main thread. The trade-off: the canvas
  // dimensions don't reflow during drag, so we imperatively grow the inner
  // div in the same rAF callback if the dragged table extends past it.
  const dragRef = useRef<{
    id: string;
    el: HTMLButtonElement;
    baseX: number;
    baseY: number;
    width: number;
    height: number;
    rotation: number;
    startCx: number;
    startCy: number;
    lastDx: number;
    lastDy: number;
    moved: boolean;
    frame: number | null;
  } | null>(null);

  const innerRef = useRef<HTMLDivElement | null>(null);

  const dims = useMemo(() => canvasSize(layoutCells), [layoutCells]);

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

  const applyDragFrame = () => {
    const ctx = dragRef.current;
    if (!ctx) return;
    ctx.frame = null;

    const newX = Math.max(0, ctx.baseX + ctx.lastDx);
    const newY = Math.max(0, ctx.baseY + ctx.lastDy);
    ctx.el.style.transform = `translate(${newX}px, ${newY}px) rotate(${ctx.rotation}deg)`;

    // Grow the canvas if needed so the dragged table stays visible inside
    // the overflow-auto wrapper instead of being clipped.
    const inner = innerRef.current;
    if (inner) {
      const minW = newX + ctx.width + CANVAS_PAD;
      const minH = newY + ctx.height + CANVAS_PAD;
      const curW = inner.offsetWidth;
      const curH = inner.offsetHeight;
      if (minW > curW) inner.style.width = `${minW}px`;
      if (minH > curH) inner.style.height = `${minH}px`;
    }
  };

  const onTablePointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (!interactive || e.button !== 0) return;
    const cell = layoutCells.find((c) => c.table.id === id);
    if (!cell) return;
    if (!tableIsDraggable(cell.table)) return;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    dragRef.current = {
      id,
      el,
      baseX: cell.x,
      baseY: cell.y,
      width: cell.w,
      height: cell.h,
      rotation: cell.rotation,
      startCx: e.clientX,
      startCy: e.clientY,
      lastDx: 0,
      lastDy: 0,
      moved: false,
      frame: null,
    };

    // Visual hints applied directly to bypass React's render cycle.
    el.style.zIndex = "10";
    el.style.willChange = "transform";
    el.style.cursor = "grabbing";
    el.style.boxShadow = "0 12px 28px -8px rgba(0,0,0,0.25)";

    const move = (ev: PointerEvent) => {
      const ctx = dragRef.current;
      if (!ctx) return;
      const dx = ev.clientX - ctx.startCx;
      const dy = ev.clientY - ctx.startCy;
      if (!ctx.moved && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
        ctx.moved = true;
      }
      ctx.lastDx = dx;
      ctx.lastDy = dy;
      if (ctx.frame == null) {
        ctx.frame = requestAnimationFrame(applyDragFrame);
      }
    };

    const cleanup = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };

    const up = (ev: PointerEvent) => {
      cleanup();

      const ctx = dragRef.current;
      dragRef.current = null;
      if (!ctx) return;

      if (ctx.frame != null) {
        cancelAnimationFrame(ctx.frame);
        ctx.frame = null;
      }

      // Strip visual hints
      ctx.el.style.zIndex = "";
      ctx.el.style.willChange = "";
      ctx.el.style.cursor = "";
      ctx.el.style.boxShadow = "";

      try {
        ctx.el.releasePointerCapture(ev.pointerId);
      } catch {
        /* capture may already be cleared */
      }

      if (!ctx.moved) {
        const t = tables.find((x) => x.id === ctx.id);
        if (t) onTableClick?.(t);
        return;
      }

      const newX = Math.max(0, ctx.baseX + ctx.lastDx);
      const newY = Math.max(0, ctx.baseY + ctx.lastDy);

      const nextCells = layoutCells.map((c) =>
        c.table.id === ctx.id ? { ...c, x: newX, y: newY } : c,
      );

      // The mutation is configured with an optimistic update (see
      // useUpdateTablePositions) so the React Query cache reflects the new
      // position immediately. That means when React re-renders after this
      // call, the table's `style.transform` from JSX will match what we
      // imperatively set — no snap-back flicker.
      persistPositions(cellsToPayload(nextCells), {
        onError: (err: unknown) => {
          // Roll the visual back to the pre-drag position if the server
          // rejects; the cache rollback in onError of the mutation handles
          // the React-side state.
          ctx.el.style.transform = `translate(${ctx.baseX}px, ${ctx.baseY}px) rotate(${ctx.rotation}deg)`;
          const msg = err instanceof Error ? err.message : "Try again.";
          toast.error("Could not save position", msg);
        },
      });
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
        <div
          ref={innerRef}
          className="relative"
          style={{ width: dims.width, height: dims.height }}
        >
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
          {layoutCells.map((cell) => {
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
                className={cn(
                  "absolute flex select-none flex-col items-center justify-center gap-0.5 border-2 px-1 text-center text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  // Drop the transition entirely while interactive — transform changes
                  // would otherwise animate the drag, fighting the rAF updates.
                  !interactive && "transition-shadow",
                  draggable && "touch-none cursor-grab active:cursor-grabbing",
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
