"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Shapes, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  VenueMapCanvas,
  type VenueMapArea,
  type VenueMapHotspot,
} from "@/components/venue-map-canvas";
import { ApiError } from "@/lib/api/client";
import { venueMapApi } from "@/lib/api/venue-map";
import { tablesKeys, useFloorSectionMutations, useTablesList } from "@/lib/hooks/use-tables";
import { useMapAssetUrl } from "@/lib/hooks/use-map-asset";
import { formatMoney } from "@/lib/format";
import { boundingBox, type Point } from "@/lib/geometry";
import { cn } from "@/lib/utils";
import type { Table, VenueMapStaffConfig } from "@/lib/types";

/**
 * Staff venue-map editor: upload the artwork for a section, then place that
 * section's tables onto it. Placement is stored in the SVG's own viewBox units,
 * which is why a table can be on the map without touching its staff floor-plan
 * position (a different, unbounded coordinate space).
 */
export function VenueMapEditor() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ["venue-map"],
    queryFn: () => venueMapApi.config().then((r) => r.data),
  });

  const { data: tables = [] } = useTablesList({ per_page: 200 });

  const sections = config.data?.sections ?? [];
  const active = sections.find((s) => s.id === sectionId) ?? sections[0] ?? null;

  const sectionTables = useMemo(
    () => (active ? tables.filter((t) => (t.section ?? "").trim() === active.name) : []),
    [tables, active],
  );

  const placed = sectionTables.filter((t) => t.map_position);
  const unplaced = sectionTables.filter((t) => !t.map_position);

  const { update: updateSection } = useFloorSectionMutations();

  // Shown in rupiah; stored as TRUE cents (IDR × 100). The draft is keyed on
  // section + server value so switching sections (or a save landing) falls back
  // to the server's number automatically — no setState inside an effect. Keeping
  // the raw string lets the field be cleared to mean "no price" without snapping
  // back to 0 mid-edit.
  const serverPrice =
    active?.default_price_cents != null ? String(active.default_price_cents / 100) : "";
  const priceKey = `${active?.id ?? ""}:${active?.default_price_cents ?? ""}`;
  const [draftPrice, setDraftPrice] = useState<{ key: string; value: string } | null>(null);
  const priceInput = draftPrice?.key === priceKey ? draftPrice.value : serverPrice;
  const setPriceInput = (value: string) => setDraftPrice({ key: priceKey, value });

  const saveSectionPrice = () => {
    if (!active) return;
    const trimmed = priceInput.trim();
    const rupiah = trimmed === "" ? null : Number(trimmed);
    if (rupiah !== null && (!Number.isFinite(rupiah) || rupiah < 0)) return;
    const cents = rupiah === null ? null : Math.round(rupiah * 100);
    if (cents === (active.default_price_cents ?? null)) return;

    updateSection.mutate(
      { id: active.id, default_price_cents: cents },
      {
        onError: (e) =>
          toast.error("Could not save price", e instanceof ApiError ? e.message : undefined),
      },
    );
  };

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["venue-map"] });
    qc.invalidateQueries({ queryKey: ["tables"], exact: false });
  }, [qc]);

  /**
   * Editing is a burst activity — dragging one table fires several saves, and
   * reshaping an outline fires one per vertex. Refetching after each would put a
   * network round trip inside the interaction loop. The optimistic writes below
   * already show the truth, so the refetch only needs to happen once the dust
   * settles, to pick up whatever the server decided (notably the auto-assigned
   * section).
   */
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateSoon = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(invalidate, 500);
  }, [invalidate]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const upload = useMutation({
    mutationFn: (file: File) => venueMapApi.uploadMap(file),
    onSuccess: () => {
      toast.success("Map uploaded");
      invalidate();
    },
    onError: (e) =>
      toast.error("Could not upload map", e instanceof ApiError ? e.message : undefined),
  });

  const savePosition = useMutation({
    mutationFn: (position: {
      id: string;
      map_position: { x: number; y: number; width?: number; height?: number } | null;
    }) => venueMapApi.savePositions([position]),

    // Write the new geometry into the cache before the request goes out. Without
    // this the canvas drops its live box on pointer-up and re-renders from the
    // stale prop — the table visibly snaps back to where the drag started, then
    // jumps to the destination when the response lands.
    //
    // Synchronous on purpose. The canvas clears its live box in the same tick
    // this fires, so an awaited write would land a microtask later — one frame
    // in which the shape renders from the stale prop, i.e. the snap-back.
    onMutate: (position) => {
      void qc.cancelQueries({ queryKey: tablesKeys.all });
      const previous = qc.getQueriesData<Table[]>({ queryKey: tablesKeys.all });

      qc.setQueriesData<Table[]>({ queryKey: tablesKeys.all }, (old) =>
        old?.map((t) =>
          t.id !== position.id
            ? t
            : {
                ...t,
                map_position: position.map_position
                  ? {
                      x: position.map_position.x,
                      y: position.map_position.y,
                      width: position.map_position.width ?? t.map_position?.width ?? 40,
                      height: position.map_position.height ?? t.map_position?.height ?? 40,
                      rotation: t.map_position?.rotation ?? 0,
                    }
                  : null,
              },
        ),
      );

      return { previous };
    },
    onError: (e, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Could not save placement", e instanceof ApiError ? e.message : undefined);
    },
    onSettled: invalidateSoon,
  });

  // Loaded through the API client, not a bare <img src>: the staff asset route
  // needs the Bearer token (and, behind a tunnel, the ngrok skip header). The
  // public route is no good here either — it requires the venue to be
  // published, and a venue is normally still unpublished while building its map.
  const venueMap = config.data?.map ?? null;
  const { url: mapUrl, failed: mapFailed } = useMapAssetUrl(
    venueMap ? `venue-map/assets/${venueMap.id}` : null,
  );

  // Saving an outline re-derives its bounding box server-side, so the editor
  // sends vertices only.
  const saveArea = useMutation({
    mutationFn: ({ id, polygon }: { id: string; polygon: Point[] | null }) =>
      venueMapApi.saveArea(id, polygon),

    // Same reasoning as placements: a dragged vertex must stay where it was
    // dropped rather than rubber-banding while the save is in flight. The bounds
    // are recomputed locally with the same formula the server uses, so the
    // focus box stays in step with the outline.
    onMutate: ({ id, polygon }) => {
      void qc.cancelQueries({ queryKey: ["venue-map"] });
      const previous = qc.getQueryData<VenueMapStaffConfig>(["venue-map"]);

      qc.setQueryData<VenueMapStaffConfig>(["venue-map"], (old) =>
        !old
          ? old
          : {
              ...old,
              sections: old.sections.map((sec) =>
                sec.id !== id
                  ? sec
                  : { ...sec, polygon, bounds: polygon ? boundingBox(polygon) : null },
              ),
            },
      );

      return { previous };
    },
    onError: (e, _vars, context) => {
      if (context?.previous) qc.setQueryData(["venue-map"], context.previous);
      toast.error("Could not save the area", e instanceof ApiError ? e.message : undefined);
    },
    onSettled: invalidateSoon,
  });

  if (config.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (sections.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Add a floor section first — each section gets its own venue map.
      </Card>
    );
  }

  const hotspots: VenueMapHotspot[] = placed.map((t) => ({
    id: t.id,
    label: t.name,
    x: t.map_position!.x,
    y: t.map_position!.y,
    width: t.map_position!.width,
    height: t.map_position!.height,
    rotation: t.map_position!.rotation,
    shape: t.shape,
    state: t.id === selectedTableId ? "selected" : "available",
  }));

  const mapAsset =
    venueMap && mapUrl
      ? {
          url: mapUrl,
          width: venueMap.width,
          height: venueMap.height,
          view_box: venueMap.view_box,
        }
      : null;

  // Every section's outline, with the selected one editable.
  const areas: VenueMapArea[] = sections
    .filter((sec) => sec.polygon && sec.polygon.length >= 3)
    .map((sec) => ({
      id: sec.id,
      label: sec.name,
      points: sec.polygon!,
      dimmed: sec.id !== active?.id,
    }));

  /**
   * Where a table from the tray lands: the centre of the current section's
   * area when it has one, else the middle of the artwork.
   */
  const dropPoint = () => {
    const b = active?.bounds;
    if (b) return { x: b.x + b.width / 2 - 20, y: b.y + b.height / 2 - 20 };
    return { x: (venueMap?.width ?? 100) / 2, y: (venueMap?.height ?? 100) / 2 };
  };

  /** A starter quad in the middle of the map — staff drag it into shape. */
  const seedArea = () => {
    if (!active || !venueMap) return;
    const w = venueMap.width;
    const h = venueMap.height;
    saveArea.mutate({
      id: active.id,
      polygon: [
        { x: w * 0.3, y: h * 0.3 },
        { x: w * 0.7, y: h * 0.3 },
        { x: w * 0.7, y: h * 0.7 },
        { x: w * 0.3, y: h * 0.7 },
      ],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Section</Label>
          <Select value={active?.id ?? ""} onValueChange={setSectionId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.is_bookable_online ? "" : " (not bookable online)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/svg+xml,.svg,image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && active) upload.mutate(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!active || upload.isPending}
          onClick={() => fileInput.current?.click()}
        >
          <ImageUp className="h-4 w-4" />
          {upload.isPending ? "Uploading…" : venueMap ? "Replace venue map" : "Upload venue map"}
        </Button>

        {venueMap ? (
          <span className="text-xs text-muted-foreground">
            {venueMap.width} × {venueMap.height}
            {venueMap.mime === "image/svg+xml" ? " units" : " px"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            SVG, or PNG/JPEG/WebP at least 1280 × 960 px
          </span>
        )}
      </div>

      {/* The switch lives here, not in Manage sections: this is where you are
          standing when the guest flow comes up empty, and `is_bookable_online`
          defaults to false so every new section starts invisible to guests. */}
      {active && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Switch
              id="section-bookable"
              checked={!!active.is_bookable_online}
              disabled={updateSection.isPending}
              onCheckedChange={(checked) =>
                updateSection.mutate(
                  { id: active.id, is_bookable_online: checked },
                  {
                    onError: (e) =>
                      toast.error(
                        "Could not update section",
                        e instanceof ApiError ? e.message : undefined,
                      ),
                  },
                )
              }
            />
            <div>
              <Label htmlFor="section-bookable" className="cursor-pointer">
                Bookable online
              </Label>
              <p className="text-xs text-muted-foreground">
                {active.is_bookable_online
                  ? "Guests can pick a spot in this area."
                  : "Guests can’t see this area yet — the booking page will look empty."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="section-price">Default price (IDR)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="section-price"
                type="number"
                min={0}
                step={1000}
                className="w-40"
                placeholder="No price"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onBlur={saveSectionPrice}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <span className="text-xs text-muted-foreground">per table</span>
            </div>
          </div>
        </Card>
      )}

      <VenueMapCanvas
        asset={mapAsset}
        hotspots={hotspots}
        areas={areas}
        editableAreaId={active?.id ?? null}
        // mutateAsync so the canvas can hold the dragged vertex until the save
        // settles; the rejection is already surfaced by the mutation's onError.
        onAreaChange={(id, polygon) => saveArea.mutateAsync({ id, polygon }).catch(() => {})}
        selectedId={selectedTableId}
        onSelect={setSelectedTableId}
        interactive
        onTransform={(id, box) =>
          savePosition.mutateAsync({ id, map_position: box }).catch(() => {})
        }
        emptyLabel={
          venueMap
            ? mapFailed
              ? "The venue map image failed to load. Check that the API is reachable."
              : "Loading the venue map…"
            : "Upload one map for the whole venue to start outlining areas."
        }
      />

      {mapAsset && active && !active.polygon && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div>
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              “{active.name}” has no area on the map
            </h3>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
              Guests can&apos;t see or pick this area until you outline it.
            </p>
          </div>
          <Button type="button" onClick={seedArea} disabled={saveArea.isPending}>
            <Shapes className="h-4 w-4" /> Draw area
          </Button>
        </Card>
      )}

      {mapAsset && active?.polygon && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Drag the square handles to reshape “{active.name}”; click a round handle to add a
            corner, double-click a square one to remove it.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saveArea.isPending}
            onClick={() => saveArea.mutate({ id: active.id, polygon: null })}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-500" /> Clear area
          </Button>
        </div>
      )}

      {mapAsset && (
        <p className="text-xs text-muted-foreground">
          Drag a table to move it; drag a corner handle to resize it. With one selected, arrow keys
          nudge and Shift + arrow keys resize. Dropping a table inside an area assigns it to that
          section. Changes save automatically.
        </p>
      )}

      {/* Unplaced tray — tables in this section that aren't on the map yet.
          A null map_position is a first-class "not placed" state, which is why
          map coords are separate from the staff floor-plan position. */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold">
          Not on the map yet ({unplaced.length})
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Guests only see tables placed on the map. Click one to drop it onto the map, then drag
          it into position.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {unplaced.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={!venueMap || savePosition.isPending}
              onClick={() =>
                savePosition.mutate({
                  id: t.id,
                  // Land inside this section's own outline, so the server's
                  // point-in-polygon check keeps the table in this section
                  // instead of reassigning it the moment it is placed.
                  map_position: dropPoint(),
                })
              }
            >
              <Upload className="h-3.5 w-3.5" /> {t.name}
            </Button>
          ))}
          {unplaced.length === 0 && (
            <span className="text-xs text-muted-foreground">Every table here is placed.</span>
          )}
        </div>
      </Card>

      {placed.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold">On the map ({placed.length})</h3>
          <ul className="mt-3 divide-y divide-border text-sm">
            {placed.map((t: Table) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className={cn(t.id === selectedTableId && "font-semibold")}>
                  {t.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    seats {t.min_capacity}–{t.max_capacity}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {t.price_cents
                      ? formatMoney(t.price_cents, "IDR")
                      : active?.default_price_cents
                        ? `${formatMoney(active.default_price_cents, "IDR")} (section)`
                        : "No price"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${t.name} from the map`}
                    onClick={() => savePosition.mutate({ id: t.id, map_position: null })}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
