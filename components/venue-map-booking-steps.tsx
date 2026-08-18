"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VenueMapCanvas,
  type VenueMapArea,
  type VenueMapHotspot,
} from "@/components/venue-map-canvas";
import { publicVenueMapApi } from "@/lib/api/venue-map";
import { useMapAssetUrl } from "@/lib/hooks/use-map-asset";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VenueMapSectionSummary, VenueMapTable } from "@/lib/types";

/**
 * A failed request and a genuinely empty venue used to render the same
 * "no areas available" text, which made an API outage indistinguishable from a
 * venue that hasn't opted a section in — for guests and for whoever is debugging.
 */
function StepError({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
        We couldn&apos;t load the floor plan
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This is on us, not you. Try again in a moment — your date and time are still selected.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}

/* ── Step: pick a section ─────────────────────────────────────────────── */

export function StepSection({
  slug,
  selectedId,
  onSelect,
  onBack,
}: {
  slug: string;
  selectedId: string | null;
  onSelect: (section: VenueMapSectionSummary) => void;
  onBack: () => void;
}) {
  const query = useQuery({
    queryKey: ["public", slug, "venue-map"],
    queryFn: async () => (await publicVenueMapApi.overview(slug)).data,
  });

  const sections = useMemo(() => query.data?.sections ?? [], [query.data]);
  const venueMap = query.data?.map ?? null;
  // Fetched rather than <img src>'d so a tunnelled dev backend (ngrok) still
  // serves the bytes instead of its browser-warning page. Cached process-wide,
  // so the spot step reuses this exact blob and the map never blinks.
  const { url: mapUrl, failed: mapFailed } = useMapAssetUrl(venueMap?.url ?? null);

  // Only outlined sections can be drawn; the card grid below covers the rest.
  const areas: VenueMapArea[] = useMemo(
    () =>
      sections
        .filter((sec) => sec.polygon && sec.polygon.length >= 3)
        .map((sec) => ({
          id: sec.id,
          label: sec.name,
          sublabel: sec.price_from_cents
            ? `from ${formatMoney(sec.price_from_cents, "IDR")}`
            : null,
          points: sec.polygon!,
        })),
    [sections],
  );

  if (query.isPending) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (query.isError) {
    return <StepError onRetry={() => query.refetch()} onBack={onBack} />;
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Choose your area</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick where you&apos;d like to sit, then choose your exact spot.
      </p>

      {/* The map itself. The card grid below is the keyboard path and the
          small-screen path — outlines are unusable at 375px. */}
      {venueMap && mapUrl && areas.length > 0 && (
        <div className="mt-4 hidden sm:block">
          <VenueMapCanvas
            asset={{ ...venueMap, url: mapUrl }}
            hotspots={[]}
            areas={areas}
            selectedId={selectedId}
            onSelectArea={(id) => {
              const section = sections.find((sec) => sec.id === id);
              if (section) onSelect(section);
            }}
          />
        </div>
      )}
      {venueMap && mapFailed && (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          The venue map image couldn&apos;t be loaded — pick an area from the list below.
        </p>
      )}

      <div className={cn("mt-4 grid gap-3 sm:grid-cols-2", venueMap && mapUrl && areas.length > 0 && "sm:mt-6")}>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors hover:bg-muted/50",
              s.id === selectedId ? "border-foreground/30 bg-muted" : "border-border",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
              {s.name}
            </span>
            {s.description && (
              <span className="mt-1 block text-xs text-muted-foreground">{s.description}</span>
            )}
            {s.price_from_cents ? (
              <span className="mt-2 block text-sm font-medium">
                from {formatMoney(s.price_from_cents, "IDR")}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {sections.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No areas are open for online booking right now.
        </p>
      )}

      <div className="mt-6">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    </Card>
  );
}

/* ── Step: pick a table within the section ────────────────────────────── */

export function StepTable({
  slug,
  sectionId,
  sectionName,
  reservedAt,
  partySize,
  selectedTableId,
  onSelect,
  onBack,
  onNext,
}: {
  slug: string;
  sectionId: string;
  sectionName: string;
  reservedAt: string;
  partySize: number;
  selectedTableId: string | null;
  onSelect: (table: VenueMapTable | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const query = useQuery({
    queryKey: ["public", slug, "venue-map", sectionId, reservedAt, partySize],
    queryFn: async () =>
      (await publicVenueMapApi.sectionTables(slug, sectionId, {
        reserved_at: reservedAt,
        party_size: partySize,
      })).data,
  });

  // The SAME query the area step ran, so this is a cache hit: the venue map and
  // every outline are already here, and the artwork blob is already loaded.
  // That is what makes the transition a zoom rather than a page swap.
  const overview = useQuery({
    queryKey: ["public", slug, "venue-map"],
    queryFn: async () => (await publicVenueMapApi.overview(slug)).data,
  });

  const tables = query.data?.tables ?? [];
  const venueMap = overview.data?.map ?? null;
  const { url: mapUrl, failed: mapFailed } = useMapAssetUrl(venueMap?.url ?? null);

  const focusBounds = query.data?.section?.bounds ?? null;

  // Neighbouring areas stay on screen, dimmed — the guest can see where they
  // are in the venue instead of floating in an unlabelled crop.
  const areas: VenueMapArea[] = useMemo(
    () =>
      (overview.data?.sections ?? [])
        .filter((sec) => sec.polygon && sec.polygon.length >= 3)
        .map((sec) => ({
          id: sec.id,
          label: sec.name,
          points: sec.polygon!,
          dimmed: sec.id !== sectionId,
          disabled: true,
        })),
    [overview.data, sectionId],
  );

  const hotspots: VenueMapHotspot[] = tables.map((t) => ({
    id: t.id,
    label: t.name,
    sublabel: `seats ${t.min_capacity}–${t.max_capacity}`,
    x: t.map_position.x,
    y: t.map_position.y,
    width: t.map_position.width,
    height: t.map_position.height,
    rotation: t.map_position.rotation,
    shape: t.shape,
    // "booked" maps onto the shared floor vocabulary's "busy".
    state: t.state === "booked" ? "busy" : t.state === "unfit" ? "unfit" : "available",
    disabled: t.state !== "available",
  }));

  const selected = tables.find((t) => t.id === selectedTableId) ?? null;

  if (query.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (query.isError) {
    return <StepError onRetry={() => query.refetch()} onBack={onBack} />;
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Choose your spot in {sectionName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Green is available; red is already booked for this time.
      </p>

      <div className="mt-4">
        <VenueMapCanvas
          asset={venueMap && mapUrl ? { ...venueMap, url: mapUrl } : null}
          hotspots={hotspots}
          areas={areas}
          focusBounds={focusBounds}
          selectedId={selectedTableId}
          onSelect={(id) => onSelect(tables.find((t) => t.id === id) ?? null)}
          loading={!!venueMap && !mapUrl && !mapFailed}
          emptyLabel={
            mapFailed
              ? "The venue map image couldn’t be loaded — pick from the list below."
              : "This venue has no map yet — pick from the list below."
          }
        />
      </div>

      {/* Keyboard- and screen-reader-navigable equivalent of the map. An
          illustrated canvas can't be operated without one (WCAG 2.1 AA), and it
          doubles as the small-screen path. */}
      <div className="mt-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          All spots
        </h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {tables.map((t) => {
            const disabled = t.state !== "available";
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(t)}
                  aria-pressed={t.id === selectedTableId}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    disabled && "cursor-not-allowed opacity-60",
                    t.id === selectedTableId
                      ? "border-foreground/30 bg-muted"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      seats {t.min_capacity}–{t.max_capacity}
                    </span>
                  </span>
                  <span className="text-right">
                    {t.price_cents > 0 && (
                      <span className="block text-xs font-medium">
                        {formatMoney(t.price_cents, "IDR")}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[11px]",
                        t.state === "booked" && "text-destructive",
                        t.state === "unfit" && "text-muted-foreground",
                        t.state === "available" && "text-emerald-600",
                      )}
                    >
                      {t.state === "booked"
                        ? "Booked"
                        : t.state === "unfit"
                          ? "Doesn't fit your party"
                          : "Available"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected && selected.price_cents > 0 && (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">{selected.name}</span> —{" "}
          {formatMoney(selected.price_cents, "IDR")}, paid now to confirm your booking.
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button type="button" disabled={!selectedTableId} onClick={onNext}>
          Continue
        </Button>
      </div>
    </Card>
  );
}
