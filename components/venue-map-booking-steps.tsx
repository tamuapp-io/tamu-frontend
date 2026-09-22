"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
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
import {
  DEFAULT_BOOKING_CHARGE,
  chargeSentence,
  type BookingChargeConfig,
} from "@/lib/booking-charge";
import { useMapAssetUrl } from "@/lib/hooks/use-map-asset";
import {
  formatGuestAssignedTables,
  formatMoney,
  guestCombinationNote,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  VenueMapCombination,
  VenueMapSectionSummary,
  VenueMapTable,
} from "@/lib/types";

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

/**
 * Where the floor plan is drawn.
 *
 * By default it sits inside the step's own card, under the heading. A theme can
 * instead hand these steps a container of its own — Atlas gives the plan the
 * whole screen and keeps the controls in its side panel — and the canvas is
 * portalled there. One component, one query, one selection either way; the
 * alternative was a second copy of the spot step that would drift from this one.
 */
function CanvasSlot({
  portal,
  className,
  children,
}: {
  portal?: Element | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (portal) return createPortal(children, portal);
  return <div className={className}>{children}</div>;
}

/* ── Step: pick a section ─────────────────────────────────────────────── */

export function StepSection({
  slug,
  selectedId,
  onSelect,
  onBack,
  reservedAt,
  canvasPortal,
}: {
  slug: string;
  selectedId: string | null;
  onSelect: (section: VenueMapSectionSummary) => void;
  onBack: () => void;
  /** The slot being booked, so areas are priced and filtered for it. */
  reservedAt?: string | null;
  /** Draw the plan here instead of inside this card. See CanvasSlot. */
  canvasPortal?: Element | null;
}) {
  // The instant is part of the key: the same venue answers differently at a
  // free hour than at a peak one, and caching those together would quote one
  // price for the other slot.
  const query = useQuery({
    queryKey: ["public", slug, "venue-map", reservedAt ?? null],
    queryFn: async () => (await publicVenueMapApi.overview(slug, reservedAt)).data,
  });

  const sections = useMemo(() => query.data?.sections ?? [], [query.data]);
  const venueMap = query.data?.map ?? null;
  // Fetched rather than <img src>'d so a tunnelled dev backend (ngrok) still
  // serves the bytes instead of its browser-warning page. Cached process-wide,
  // so the spot step reuses this exact blob and the map never blinks.
  const { url: mapUrl, failed: mapFailed } = useMapAssetUrl(venueMap?.url ?? null, venueMap?.direct_url);

  // Only outlined sections can be drawn; the card grid below covers the rest.
  const areas: VenueMapArea[] = useMemo(
    () =>
      sections
        .filter((sec) => sec.polygon && sec.polygon.length >= 3)
        .map((sec) => ({
          id: sec.id,
          label: sec.name,
          sublabel: sec.price_from_cents == null
            ? null
            : sec.price_from_cents === 0
              ? "Free"
              : "from " + formatMoney(sec.price_from_cents, "IDR"),
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
          small-screen path — outlines are unusable at 375px, so the card keeps
          it to sm and up. A theme that portals it out has given it room to be
          usable, and that rule does not apply there. */}
      {venueMap && mapUrl && areas.length > 0 && (
        <CanvasSlot portal={canvasPortal} className="mt-4 hidden sm:block">
          <VenueMapCanvas
            asset={{ ...venueMap, url: mapUrl }}
            hotspots={[]}
            areas={areas}
            selectedId={selectedId}
            /*
             * Zoom to the area once it is chosen — including when a guest
             * comes BACK to this step, where an unfocused whole-venue view
             * gives no sign of what they already picked.
             */
            focusBounds={sections.find((sec) => sec.id === selectedId)?.bounds ?? null}
            onSelectArea={(id) => {
              const section = sections.find((sec) => sec.id === id);
              if (section) onSelect(section);
            }}
          />
        </CanvasSlot>
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
            {/* Null means nothing is priced here; 0 means this slot is free,
                which is a thing worth saying rather than a blank space. */}
            {s.price_from_cents == null ? null : s.price_from_cents === 0 ? (
              <span className="mt-2 block text-sm font-medium">Free</span>
            ) : (
              <span className="mt-2 block text-sm font-medium">
                from {formatMoney(s.price_from_cents, "IDR")}
              </span>
            )}
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

/**
 * Group hotspots are keyed by group AND member: the same table can belong to
 * more than one group, and an id of just the table would make two groups
 * indistinguishable on click.
 */
const comboHotspotId = (combinationId: string, tableId: string) =>
  `combo:${combinationId}:${tableId}`;

const comboIdFromHotspot = (hotspotId: string): string | null =>
  hotspotId.startsWith("combo:") ? (hotspotId.split(":")[1] ?? null) : null;

export function StepTable({
  slug,
  sectionId,
  sectionName,
  reservedAt,
  partySize,
  selectedTableId,
  selectedCombinationId,
  onSelect,
  onSelectCombination,
  onBack,
  onNext,
  canvasPortal,
  charge = DEFAULT_BOOKING_CHARGE,
}: {
  slug: string;
  sectionId: string;
  sectionName: string;
  reservedAt: string;
  partySize: number;
  selectedTableId: string | null;
  selectedCombinationId: string | null;
  onSelect: (table: VenueMapTable | null) => void;
  onSelectCombination: (combination: VenueMapCombination | null) => void;
  onBack: () => void;
  onNext: () => void;
  /** Draw the plan here instead of inside this card. See CanvasSlot. */
  canvasPortal?: Element | null;
  /** How this venue words its amounts and how much it takes online. */
  charge?: BookingChargeConfig;
}) {
  const query = useQuery({
    queryKey: ["public", slug, "venue-map", sectionId, reservedAt, partySize],
    queryFn: async () =>
      (await publicVenueMapApi.sectionTables(slug, sectionId, {
        reserved_at: reservedAt,
        party_size: partySize,
      })).data,
  });

  // The SAME query the area step ran — same key, same instant — so this is a
  // cache hit: the venue map and every outline are already here, and the
  // artwork blob is already loaded. That is what makes the transition a zoom
  // rather than a page swap.
  const overview = useQuery({
    queryKey: ["public", slug, "venue-map", reservedAt ?? null],
    queryFn: async () => (await publicVenueMapApi.overview(slug, reservedAt)).data,
  });

  const tables = query.data?.tables ?? [];
  const combinations = useMemo(() => query.data?.combinations ?? [], [query.data]);
  const venueMap = overview.data?.map ?? null;
  const { url: mapUrl, failed: mapFailed } = useMapAssetUrl(venueMap?.url ?? null, venueMap?.direct_url);

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

  const offeredGroups = useMemo(
    () => combinations.filter((c) => c.state === "available"),
    [combinations],
  );

  /**
   * Members of a group that is on offer, where the table can't be taken alone.
   * Drawing both would stack an unfit table under a bookable group on the same
   * coordinates — two hotspots, one of them a lie.
   */
  const supersededTableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of offeredGroups) {
      for (const t of group.tables) ids.add(t.id);
    }
    return ids;
  }, [offeredGroups]);

  const hotspots: VenueMapHotspot[] = [
    ...tables
      .filter((t) => !(t.state !== "available" && supersededTableIds.has(t.id)))
      .map((t) => ({
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
        state: (t.state === "booked"
          ? "busy"
          : t.state === "unfit"
            ? "unfit"
            : "available") as VenueMapHotspot["state"],
        disabled: t.state !== "available",
      })),
    // One hotspot per member, so a group reads on the map as the several tables
    // it actually is. Selecting any of them selects the whole group.
    ...offeredGroups.flatMap((c) =>
      c.tables.map((t) => ({
        id: comboHotspotId(c.id, t.id),
        label: t.name,
        sublabel: `together · seats up to ${c.max_capacity}`,
        x: t.map_position.x,
        y: t.map_position.y,
        width: t.map_position.width,
        height: t.map_position.height,
        rotation: t.map_position.rotation,
        shape: t.shape,
        state: "available" as VenueMapHotspot["state"],
      })),
    ),
  ];

  const selected = tables.find((t) => t.id === selectedTableId) ?? null;
  const selectedGroup = combinations.find((c) => c.id === selectedCombinationId) ?? null;

  // The canvas highlights every hotspot in the array, so a chosen group lights
  // up all of its tables rather than one of them.
  const canvasSelection = selectedGroup
    ? selectedGroup.tables.map((t) => comboHotspotId(selectedGroup.id, t.id))
    : selectedTableId;

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
        {offeredGroups.length > 0 && (
          <>
            {" "}
            Your party needs more than one table, so tables that can be pushed together
            are offered as a set.
          </>
        )}
      </p>

      <CanvasSlot portal={canvasPortal} className="mt-4">
        <VenueMapCanvas
          asset={venueMap && mapUrl ? { ...venueMap, url: mapUrl } : null}
          hotspots={hotspots}
          areas={areas}
          focusBounds={focusBounds}
          selectedId={canvasSelection}
          onSelect={(id) => {
            const comboId = comboIdFromHotspot(id);
            if (comboId) {
              onSelectCombination(combinations.find((c) => c.id === comboId) ?? null);
              return;
            }
            onSelect(tables.find((t) => t.id === id) ?? null);
          }}
          loading={!!venueMap && !mapUrl && !mapFailed}
          emptyLabel={
            mapFailed
              ? "The venue map image couldn’t be loaded — pick from the list below."
              : "This venue has no map yet — pick from the list below."
          }
        />
      </CanvasSlot>

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
                        t.state === "available" && "text-[color:var(--bk-success,#059669)]",
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

          {/* Groups live in the same list as single tables: for a party that
              fits no one table these are the ONLY bookable options, and a
              separate section below the fold would read as unavailable. */}
          {offeredGroups.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelectCombination(c)}
                aria-pressed={c.id === selectedCombinationId}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  c.id === selectedCombinationId
                    ? "border-foreground/30 bg-muted"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span>
                  <span className="font-medium">
                    {formatGuestAssignedTables(c.tables) ?? "Tables together"}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    seats {c.min_capacity}–{c.max_capacity}
                  </span>
                </span>
                <span className="text-right">
                  {c.price_cents > 0 && (
                    <span className="block text-xs font-medium">
                      {formatMoney(c.price_cents, "IDR")}
                    </span>
                  )}
                  <span className="text-[11px] text-[color:var(--bk-success,#059669)]">Available</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* A party that fits nothing at all is a dead end with no explanation —
          the guest sees a greyed-out floor and no reason for it. */}
      {hotspots.every((h) => h.disabled) && offeredGroups.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nothing in {sectionName} fits a party of {partySize} at this time. Try another
          area, another time, or{" "}
          <button type="button" className="underline underline-offset-2" onClick={onBack}>
            go back
          </button>
          .
        </p>
      )}
      {/* The one line that says what this costs. Worded by the venue's charge
          settings, not hard-coded: a minimum spend that claims to be "paid now
          to confirm" tells the guest their money is gone when in fact it comes
          off their bill. */}
      {selected && selected.price_cents > 0 && (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">{selected.name}</span> —{" "}
          {chargeSentence(selected.price_cents, charge, (c) => formatMoney(c, "IDR"))}
        </p>
      )}

      {selectedGroup && (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">
            {formatGuestAssignedTables(selectedGroup.tables)}
          </span>
          {selectedGroup.price_cents > 0 && (
            <>
              {" "}
              — {chargeSentence(selectedGroup.price_cents, charge, (c) => formatMoney(c, "IDR"))}
            </>
          )}
          <span className="mt-1 block text-xs text-muted-foreground">
            {guestCombinationNote(selectedGroup.tables.length, partySize)}
          </span>
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          type="button"
          disabled={!selectedTableId && !selectedCombinationId}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </Card>
  );
}
