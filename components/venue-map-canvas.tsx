"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  floorStateFill,
  floorStateGlyph,
  floorStateLabel,
  floorStateStroke,
  type FloorState,
} from "@/components/floor-state-colors";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { centroid, edgeMidpoints, type Bounds, type Point } from "@/lib/geometry";
import { cn } from "@/lib/utils";

export interface VenueMapAsset {
  url: string;
  width: number;
  height: number;
  view_box: string;
}

export interface VenueMapHotspot {
  id: string;
  label: string;
  sublabel?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  shape?: "round" | "rectangle" | "booth" | string;
  state: FloorState;
  disabled?: boolean;
}

/** A section outlined on the map. */
export interface VenueMapArea {
  id: string;
  label: string;
  sublabel?: string | null;
  points: Point[];
  /** Dimmed areas are visible for context but not the current subject. */
  dimmed?: boolean;
  disabled?: boolean;
}

export interface VenueMapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VenueMapCanvasProps {
  asset: VenueMapAsset | null;
  hotspots: VenueMapHotspot[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Fallback when the venue hasn't uploaded artwork for this scope. */
  emptyLabel?: string;
  /** Staff editor: drag hotspots to move them, drag their corners to resize. */
  interactive?: boolean;
  /**
   * Fires once per gesture, with the box in the SVG's own viewBox units.
   * Return the save's promise and the shape is held at the dropped position for
   * exactly as long as it is in flight — then released to whatever the data says
   * (the new position on success, the rolled-back one on failure).
   */
  onTransform?: (id: string, box: VenueMapBox) => void | Promise<unknown>;

  /** Section outlines drawn on the map. */
  areas?: VenueMapArea[];
  onSelectArea?: (id: string) => void;
  /**
   * Zoom and pan so this box fills the frame. This is what makes picking an
   * area feel like moving *within* one venue rather than loading a new picture.
   */
  focusBounds?: Bounds | null;
  /** Staff editor: the area whose vertices are editable right now. */
  editableAreaId?: string | null;
  onAreaChange?: (id: string, points: Point[]) => void | Promise<unknown>;
}

const MIN_SCALE = 1;
/**
 * A section can be a small corner of a large venue, and 4x would leave it a
 * postage stamp. The cap is derived per-focus instead (see fitBounds).
 */
const MAX_SCALE = 12;
/** Leaves the focused area breathing room instead of bleeding off the edges. */
const FOCUS_PADDING = 0.12;

/** Smallest a table may be dragged down to, in viewBox units. */
const MIN_BOX = 8;
/** Keyboard nudge, in viewBox units. */
const STEP = 2;

const CORNERS = ["nw", "ne", "sw", "se"] as const;
type Corner = (typeof CORNERS)[number];

const CORNER_CURSOR: Record<Corner, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
};

const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function cornerPoint(corner: Corner, box: VenueMapBox): { x: number; y: number } {
  return {
    x: corner === "nw" || corner === "sw" ? box.x : box.x + box.width,
    y: corner === "nw" || corner === "ne" ? box.y : box.y + box.height,
  };
}

/**
 * Resize against the opposite corner as a fixed anchor. Clamping the moving
 * edge (rather than the resulting size) is what stops the box inverting when
 * the pointer crosses past the anchor.
 */
function resizeBox(base: VenueMapBox, corner: Corner, p: { x: number; y: number }): VenueMapBox {
  const right = base.x + base.width;
  const bottom = base.y + base.height;
  let { x, y, width, height } = base;

  if (corner === "nw" || corner === "sw") {
    x = Math.min(p.x, right - MIN_BOX);
    width = right - x;
  } else {
    width = Math.max(MIN_BOX, p.x - base.x);
  }

  if (corner === "nw" || corner === "ne") {
    y = Math.min(p.y, bottom - MIN_BOX);
    height = bottom - y;
  } else {
    height = Math.max(MIN_BOX, p.y - base.y);
  }

  return { x, y, width, height };
}

/**
 * Pointer coords arrive in unrotated viewBox space, but the handles are drawn
 * inside the hotspot's rotated group — so a rotated table would resize along the
 * wrong axes without mapping the pointer into its local frame first.
 */
function unrotate(
  p: { x: number; y: number },
  cx: number,
  cy: number,
  degrees: number,
): { x: number; y: number } {
  if (!degrees) return p;
  const r = (-degrees * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * Math.cos(r) - dy * Math.sin(r),
    y: cy + dx * Math.sin(r) + dy * Math.cos(r),
  };
}

/**
 * Pan/zoomable venue map: the uploaded SVG as a background image, with an
 * overlay <svg> carrying THE SAME viewBox drawing the interactive hotspots.
 *
 * Because both layers share the viewBox and preserveAspectRatio, hotspots stay
 * pinned to the artwork at any container size with no manual scale math — which
 * is why this is an SVG overlay rather than the absolutely-positioned divs the
 * staff floor plan uses (that canvas is content-sized and unbounded; this one is
 * anchored to a fixed coordinate space).
 *
 * The map is rendered via <img>, never inlined: browsers don't execute scripts
 * in SVG loaded as an image, so hostile artwork can't run even if it somehow got
 * past the server-side sanitizer.
 */
export function VenueMapCanvas({
  asset,
  hotspots,
  selectedId,
  onSelect,
  emptyLabel = "No map uploaded yet.",
  interactive = false,
  onTransform,
  areas = [],
  onSelectArea,
  focusBounds = null,
  editableAreaId = null,
  onAreaChange,
}: VenueMapCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const view = useRef({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ active: boolean; startX: number; startY: number } | null>(null);
  const [zoomLabel, setZoomLabel] = useState(1);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const assetWidth = asset?.width ?? 0;
  const assetHeight = asset?.height ?? 0;

  // Live vertex drag for the area being edited.
  const [liveArea, setLiveAreaState] = useState<{ id: string; points: Point[] } | null>(null);
  const liveAreaRef = useRef<{ id: string; points: Point[] } | null>(null);
  const liveAreaRaf = useRef<number | null>(null);
  const setLiveArea = useCallback((next: { id: string; points: Point[] } | null) => {
    liveAreaRef.current = next;

    if (next === null) {
      if (liveAreaRaf.current !== null) {
        cancelAnimationFrame(liveAreaRaf.current);
        liveAreaRaf.current = null;
      }
      setLiveAreaState(null);
      return;
    }

    if (liveAreaRaf.current !== null) return;
    liveAreaRaf.current = requestAnimationFrame(() => {
      liveAreaRaf.current = null;
      setLiveAreaState(liveAreaRef.current);
    });
  }, []);
  const vertexDrag = useRef<{ id: string; index: number } | null>(null);

  /** Vertex equivalent of `held` — same reasoning, same lifetime rule. */
  const [heldArea, setHeldArea] = useState<{ id: string; points: Point[] } | null>(null);

  /**
   * The box a gesture just committed, shown until its save settles.
   *
   * The parent saves optimistically, but that write lands in a microtask and
   * React can flush it after a paint — one frame in which the shape renders from
   * its pre-drag position, which is the snap-back. Holding it for the life of the
   * request closes that window without guessing at flush timing, and releasing on
   * settle (not on success) means a failed save correctly reverts.
   */
  const [held, setHeld] = useState<{ id: string; box: VenueMapBox } | null>(null);

  // Live box, in viewBox units, for the hotspot being moved or resized. Kept in
  // state (not a ref) because the shape has to re-render as it travels.
  const [live, setLiveState] = useState<({ id: string } & VenueMapBox) | null>(null);
  // Mirrored in a ref so commit() can read the final box without doing its work
  // inside a state updater — React double-invokes those in StrictMode, which
  // would fire two save requests per drag.
  const liveRef = useRef<({ id: string } & VenueMapBox) | null>(null);
  const liveRaf = useRef<number | null>(null);

  /**
   * Pointer events fire faster than the display refreshes (and arrive coalesced
   * on high-rate trackpads), so one setState per event re-renders the canvas
   * several times per frame for no visible gain. The ref updates synchronously —
   * commit() must see the final position even if the last frame never ran — while
   * the render is collapsed to at most once per frame.
   */
  const setLive = useCallback((next: ({ id: string } & VenueMapBox) | null) => {
    liveRef.current = next;

    if (next === null) {
      if (liveRaf.current !== null) {
        cancelAnimationFrame(liveRaf.current);
        liveRaf.current = null;
      }
      setLiveState(null);
      return;
    }

    if (liveRaf.current !== null) return;
    liveRaf.current = requestAnimationFrame(() => {
      liveRaf.current = null;
      setLiveState(liveRef.current);
    });
  }, []);
  // The gesture's immutable starting point. Reading the base off the hotspot
  // prop mid-gesture would compound each frame's own change and make the box
  // run away from the pointer.
  const gesture = useRef<{
    kind: "move" | "resize";
    id: string;
    corner?: Corner;
    base: VenueMapBox;
  } | null>(null);

  /**
   * Screen point → viewBox units. Uses the SVG's own CTM so it stays correct
   * under pan, zoom, and preserveAspectRatio letterboxing — hand-rolling the
   * conversion from bounding boxes gets this subtly wrong.
   */
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  // Mutate the transform on a ref inside rAF rather than through React state —
  // a setState per pointermove pegs the main thread on a large map.
  const applyTransform = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const { scale, x, y } = view.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const clampPan = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const { scale } = view.current;
    // Never let the artwork leave the frame.
    const maxX = 0;
    const maxY = 0;
    const minX = frame.clientWidth * (1 - scale);
    const minY = frame.clientHeight * (1 - scale);
    view.current.x = Math.min(maxX, Math.max(minX, view.current.x));
    view.current.y = Math.min(maxY, Math.max(minY, view.current.y));
  }, []);

  const zoomTo = useCallback(
    (next: number, originX?: number, originY?: number) => {
      const frame = frameRef.current;
      if (!frame) return;
      const prev = view.current.scale;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      if (scale === prev) return;

      // Keep the point under the cursor fixed while zooming.
      const cx = originX ?? frame.clientWidth / 2;
      const cy = originY ?? frame.clientHeight / 2;
      view.current.x = cx - ((cx - view.current.x) * scale) / prev;
      view.current.y = cy - ((cy - view.current.y) * scale) / prev;
      view.current.scale = scale;

      clampPan();
      requestAnimationFrame(applyTransform);
      setZoomLabel(scale);
    },
    [applyTransform, clampPan],
  );

  /**
   * Zoom and pan so `bounds` (in viewBox units) fills the frame.
   *
   * The maths has to account for preserveAspectRatio="xMidYMid meet": at scale 1
   * the artwork is letterboxed inside the frame, so viewBox units and frame
   * pixels differ by `contentScale` plus a centring offset. Deriving that here
   * is what lets a section's box be expressed purely in map coordinates.
   */
  const fitBounds = useCallback(
    (bounds: Bounds, animate: boolean) => {
      const frame = frameRef.current;
      const stage = stageRef.current;
      if (!frame || !stage || !assetWidth || !assetHeight) return;
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const contentScale = Math.min(fw / assetWidth, fh / assetHeight);
      const offsetX = (fw - assetWidth * contentScale) / 2;
      const offsetY = (fh - assetHeight * contentScale) / 2;

      const scale = Math.min(
        MAX_SCALE,
        Math.max(
          MIN_SCALE,
          Math.min(fw / (bounds.width * contentScale), fh / (bounds.height * contentScale)) *
            (1 - 2 * FOCUS_PADDING),
        ),
      );

      // Put the box's centre at the frame's centre.
      const cx = offsetX + (bounds.x + bounds.width / 2) * contentScale;
      const cy = offsetY + (bounds.y + bounds.height / 2) * contentScale;

      view.current.scale = scale;
      view.current.x = fw / 2 - cx * scale;
      view.current.y = fh / 2 - cy * scale;
      clampPan();

      stage.style.transition =
        animate && !reduceMotion ? "transform 380ms cubic-bezier(0.4, 0, 0.2, 1)" : "";
      requestAnimationFrame(applyTransform);
      setZoomLabel(scale);
    },
    // Deliberately the dimensions, not `asset`: callers rebuild that object every
    // render, and depending on it made this callback — and the focus effect that
    // uses it — churn on every single render.
    [applyTransform, clampPan, assetWidth, assetHeight, reduceMotion],
  );

  /** A hand gesture must win instantly; an in-flight tween would fight it. */
  const cancelTween = useCallback(() => {
    if (stageRef.current) stageRef.current.style.transition = "";
  }, []);

  // Re-fit whenever the focused area changes. Runs on mount too, so the spot
  // step opens already framed on the chosen area rather than animating from
  // the whole venue every time it mounts.
  //
  // fitBounds is keyed off the asset's dimensions rather than the asset object,
  // so it stays referentially stable — otherwise this effect re-ran on every
  // render, snapping the view back mid-gesture and undoing the user's pan.
  const focusKey = focusBounds
    ? `${focusBounds.x},${focusBounds.y},${focusBounds.width},${focusBounds.height}`
    : "";
  const hasFocusedOnce = useRef(false);
  useEffect(() => {
    if (!focusKey) {
      hasFocusedOnce.current = false;
      return;
    }
    const [x, y, width, height] = focusKey.split(",").map(Number);
    fitBounds({ x, y, width, height }, hasFocusedOnce.current);
    hasFocusedOnce.current = true;
  }, [focusKey, fitBounds]);

  /** Ends the gesture, persisting only if the box actually changed. */
  const commit = useCallback(() => {
    const g = gesture.current;
    const current = liveRef.current;
    gesture.current = null;
    setLive(null);

    if (!g || !current || current.id !== g.id) return;

    // A click shouldn't write — only a real drag does.
    const changed =
      Math.abs(current.x - g.base.x) > 0.5 ||
      Math.abs(current.y - g.base.y) > 0.5 ||
      Math.abs(current.width - g.base.width) > 0.5 ||
      Math.abs(current.height - g.base.height) > 0.5;

    if (!changed) return;

    const box = {
      x: Math.round(current.x),
      y: Math.round(current.y),
      width: Math.round(current.width),
      height: Math.round(current.height),
    };

    setHeld({ id: g.id, box });
    Promise.resolve(onTransform?.(g.id, box))
      .catch(() => {})
      .finally(() => setHeld((h) => (h?.id === g.id ? null : h)));
  }, [onTransform, setLive]);

  if (!asset) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  // Handles are drawn in viewBox units, so size them off the artwork rather than
  // hardcoding: the same pixel value would be invisible on a 4000-unit map and
  // swallow the table on a 200-unit one.
  const handleSize = Math.max(6, Math.min(asset.width, asset.height) * 0.018);
  const vertexSize = Math.max(7, Math.min(asset.width, asset.height) * 0.02);

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-xl border border-border bg-muted/20 touch-none"
        style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
        onWheel={(e) => {
          e.preventDefault();
          cancelTween();
          const rect = frameRef.current?.getBoundingClientRect();
          zoomTo(
            view.current.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15),
            rect ? e.clientX - rect.left : undefined,
            rect ? e.clientY - rect.top : undefined,
          );
        }}
        onPointerDown={(e) => {
          cancelTween();
          if (view.current.scale <= 1) return;
          drag.current = {
            active: true,
            startX: e.clientX - view.current.x,
            startY: e.clientY - view.current.y,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current?.active) return;
          view.current.x = e.clientX - drag.current.startX;
          view.current.y = e.clientY - drag.current.startY;
          clampPan();
          requestAnimationFrame(applyTransform);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div ref={stageRef} className="absolute inset-0 origin-top-left">
          {/* Artwork. As an <img>, any script inside it is inert. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
          />

          {/* Hotspots share the artwork's viewBox, so they stay aligned at any size. */}
          <svg
            ref={svgRef}
            viewBox={asset.view_box}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
          >
            {/* Areas render first so tables always sit on top of their section. */}
            {areas.map((area) => {
              const editing = editableAreaId === area.id;
              const pendingPoints = heldArea?.id === area.id ? heldArea.points : null;
              const points =
                liveArea?.id === area.id
                  ? liveArea.points
                  : (pendingPoints ?? area.points);
              if (points.length < 3) return null;

              const d = points.map((pt) => `${pt.x},${pt.y}`).join(" ");
              const label = centroid(points);
              const clickable = !!onSelectArea && !area.disabled && !editing;

              return (
                <g
                  key={area.id}
                  className={cn(
                    "transition-opacity",
                    area.dimmed && "opacity-30",
                    clickable && "cursor-pointer",
                  )}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? `${area.label}${area.sublabel ? ` · ${area.sublabel}` : ""}` : undefined}
                  onPointerDown={(e) => {
                    // As above: stop the frame panning out from under the tap.
                    if (clickable) e.stopPropagation();
                  }}
                  onClick={() => clickable && onSelectArea?.(area.id)}
                  onKeyDown={(e) => {
                    if (clickable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelectArea?.(area.id);
                    }
                  }}
                >
                  <polygon
                    points={d}
                    className={cn(
                      "fill-foreground/5 stroke-foreground/40",
                      editing && "fill-foreground/10 stroke-foreground",
                      clickable && "hover:fill-foreground/10",
                    )}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={editing ? undefined : "6 4"}
                  />
                  {label && !area.dimmed && (
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor="middle"
                      className="pointer-events-none select-none fill-foreground font-medium uppercase"
                      style={{ fontSize: Math.max(10, asset.height * 0.028) }}
                    >
                      {area.label}
                    </text>
                  )}

                  {editing && (
                    <>
                      {/* Midpoints insert a vertex; the shape only gains detail
                          where staff actually need it. */}
                      {edgeMidpoints(points).map((mid, i) => (
                        <circle
                          key={`mid-${i}`}
                          cx={mid.x}
                          cy={mid.y}
                          r={vertexSize / 2.6}
                          className="cursor-copy fill-background stroke-foreground/50"
                          vectorEffect="non-scaling-stroke"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const next = [...points];
                            next.splice(i + 1, 0, { x: mid.x, y: mid.y });
                            onAreaChange?.(area.id, next);
                          }}
                        />
                      ))}
                      {points.map((pt, i) => (
                        <rect
                          key={`v-${i}`}
                          x={pt.x - vertexSize / 2}
                          y={pt.y - vertexSize / 2}
                          width={vertexSize}
                          height={vertexSize}
                          className="cursor-move fill-background stroke-foreground"
                          vectorEffect="non-scaling-stroke"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            (e.target as Element).setPointerCapture?.(e.pointerId);
                            vertexDrag.current = { id: area.id, index: i };
                            setLiveArea({ id: area.id, points });
                          }}
                          onPointerMove={(e) => {
                            const g = vertexDrag.current;
                            if (g?.id !== area.id || g.index !== i) return;
                            e.stopPropagation();
                            const p = toViewBox(e.clientX, e.clientY);
                            if (!p) return;
                            const next = [...points];
                            next[i] = { x: p.x, y: p.y };
                            setLiveArea({ id: area.id, points: next });
                          }}
                          onPointerUp={(e) => {
                            if (vertexDrag.current?.id !== area.id) return;
                            e.stopPropagation();
                            vertexDrag.current = null;
                            const finished = liveAreaRef.current;
                            setLiveArea(null);
                            if (finished) {
                              setHeldArea({ id: area.id, points: finished.points });
                              Promise.resolve(onAreaChange?.(area.id, finished.points))
                                .catch(() => {})
                                .finally(() =>
                                  setHeldArea((a) => (a?.id === area.id ? null : a)),
                                );
                            }
                          }}
                          onDoubleClick={(e) => {
                            // A triangle is the floor; below that it stops being an area.
                            e.stopPropagation();
                            if (points.length <= 3) return;
                            onAreaChange?.(area.id, points.filter((_, j) => j !== i));
                          }}
                        />
                      ))}
                    </>
                  )}
                </g>
              );
            })}

            {hotspots.map((h) => {
              const isSelected = h.id === selectedId;
              const state: FloorState = isSelected ? "selected" : h.state;
              const glyph = floorStateGlyph(state);
              // While dragging, render the live box rather than the saved one
              // so the shape tracks the pointer.
              // Live drag wins; then a just-committed box, but only while the
              // prop still shows the pre-drag value; then the prop itself.
              const pending = held?.id === h.id ? held.box : null;
              const l = live?.id === h.id ? live : pending;
              const box: VenueMapBox = l
                ? { x: l.x, y: l.y, width: l.width, height: l.height }
                : { x: h.x, y: h.y, width: h.width, height: h.height };
              const cx = box.x + box.width / 2;
              const cy = box.y + box.height / 2;
              const showHandles = interactive && isSelected && !h.disabled;

              return (
                <g
                  key={h.id}
                  role="button"
                  tabIndex={h.disabled ? -1 : 0}
                  aria-label={`${h.label}${h.sublabel ? ` · ${h.sublabel}` : ""} · ${state}`}
                  aria-pressed={isSelected}
                  aria-disabled={h.disabled}
                  className={cn(
                    "transition-opacity [&>*]:transition-all",
                    h.disabled
                      ? "cursor-not-allowed opacity-70"
                      : interactive
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-pointer hover:opacity-90",
                  )}
                  transform={h.rotation ? `rotate(${h.rotation} ${cx} ${cy})` : undefined}
                  onPointerDown={(e) => {
                    if (h.disabled) return;
                    // Claim the gesture BEFORE the interactive check. Once the
                    // map is zoomed (the guest spot step always is), the frame
                    // starts a pan on pointerdown and calls setPointerCapture —
                    // which re-targets the following click to the frame, so a
                    // guest tapping a table selected nothing at all.
                    e.stopPropagation();
                    if (!interactive) return;
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    gesture.current = { kind: "move", id: h.id, base: box };
                    setLive({ id: h.id, ...box });
                    onSelect?.(h.id);
                  }}
                  onPointerMove={(e) => {
                    const g = gesture.current;
                    if (g?.kind !== "move" || g.id !== h.id) return;
                    e.stopPropagation();
                    const p = toViewBox(e.clientX, e.clientY);
                    if (!p) return;
                    // Centre the shape on the pointer.
                    setLive({
                      id: h.id,
                      x: p.x - g.base.width / 2,
                      y: p.y - g.base.height / 2,
                      width: g.base.width,
                      height: g.base.height,
                    });
                  }}
                  onPointerUp={(e) => {
                    if (gesture.current?.id !== h.id) return;
                    e.stopPropagation();
                    commit();
                  }}
                  onPointerCancel={() => {
                    if (gesture.current?.id === h.id) commit();
                  }}
                  onClick={() => {
                    if (h.disabled || interactive) return;
                    onSelect?.(h.id);
                  }}
                  onKeyDown={(e) => {
                    if (h.disabled) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(h.id);
                      return;
                    }
                    // Keyboard equivalent of the drag gestures — an SVG canvas
                    // is otherwise unusable without a mouse (WCAG 2.1 AA).
                    const d = NUDGE[e.key];
                    if (!interactive || !d) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect?.(h.id);
                    onTransform?.(
                      h.id,
                      e.shiftKey
                        ? {
                            x: h.x,
                            y: h.y,
                            width: Math.max(MIN_BOX, Math.round(h.width + d[0] * STEP)),
                            height: Math.max(MIN_BOX, Math.round(h.height + d[1] * STEP)),
                          }
                        : {
                            x: Math.round(h.x + d[0] * STEP),
                            y: Math.round(h.y + d[1] * STEP),
                            width: h.width,
                            height: h.height,
                          },
                    );
                  }}
                >
                  {h.shape === "round" ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={Math.min(box.width, box.height) / 2}
                      className={cn("stroke-2", floorStateFill(state), floorStateStroke(state))}
                    />
                  ) : (
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      rx={Math.min(6, box.width / 6)}
                      className={cn("stroke-2", floorStateFill(state), floorStateStroke(state))}
                    />
                  )}
                  <text
                    x={cx}
                    y={cy + box.height * 0.12}
                    textAnchor="middle"
                    className={cn(
                      "pointer-events-none select-none font-medium",
                      floorStateLabel(state),
                    )}
                    style={{ fontSize: Math.max(8, box.height * 0.32) }}
                  >
                    {glyph ?? h.label}
                  </text>

                  {showHandles && (
                    <>
                      {/* Outline makes the editable bounds legible on a round
                          table, whose shape doesn't reach its own corners. */}
                      <rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        fill="none"
                        className="stroke-foreground/40"
                        strokeDasharray="3 3"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                      />
                      {CORNERS.map((corner) => {
                        const pt = cornerPoint(corner, box);
                        return (
                          <rect
                            key={corner}
                            x={pt.x - handleSize / 2}
                            y={pt.y - handleSize / 2}
                            width={handleSize}
                            height={handleSize}
                            rx={handleSize / 4}
                            className="fill-background stroke-foreground"
                            vectorEffect="non-scaling-stroke"
                            style={{ cursor: CORNER_CURSOR[corner] }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              (e.target as Element).setPointerCapture?.(e.pointerId);
                              gesture.current = { kind: "resize", id: h.id, corner, base: box };
                              setLive({ id: h.id, ...box });
                            }}
                            onPointerMove={(e) => {
                              const g = gesture.current;
                              if (g?.kind !== "resize" || g.id !== h.id) return;
                              e.stopPropagation();
                              const raw = toViewBox(e.clientX, e.clientY);
                              if (!raw) return;
                              const p = unrotate(
                                raw,
                                g.base.x + g.base.width / 2,
                                g.base.y + g.base.height / 2,
                                h.rotation ?? 0,
                              );
                              setLive({ id: h.id, ...resizeBox(g.base, g.corner!, p) });
                            }}
                            onPointerUp={(e) => {
                              if (gesture.current?.id !== h.id) return;
                              e.stopPropagation();
                              commit();
                            }}
                            onPointerCancel={() => {
                              if (gesture.current?.id === h.id) commit();
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            onClick={() => zoomTo(view.current.scale * 1.4)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            onClick={() => zoomTo(view.current.scale / 1.4)}
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {zoomLabel > 1 && (
        <p className="text-center text-[11px] text-muted-foreground">
          Zoomed {zoomLabel.toFixed(1)}× — drag to pan
        </p>
      )}
    </div>
  );
}
