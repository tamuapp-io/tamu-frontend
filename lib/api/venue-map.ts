import { api } from "@/lib/api/client";
import type { Bounds, Point } from "@/lib/geometry";
import type {
  ItemEnvelope,
  VenueMapOverview,
  VenueMapSectionTables,
  VenueMapStaffConfig,
} from "@/lib/types";

/**
 * Guest-facing venue map (no auth — tenant comes from the slug). Returns
 * `enabled: false` rather than erroring when the venue lacks the feature, so
 * callers can fall back to the classic slot flow.
 */
export const publicVenueMapApi = {
  overview: (slug: string) =>
    api.get<ItemEnvelope<VenueMapOverview>>(`public/${slug}/venue-map`, { auth: false }),

  sectionTables: (
    slug: string,
    sectionId: string,
    params: { reserved_at: string; party_size: number },
  ) =>
    api.get<ItemEnvelope<VenueMapSectionTables>>(
      `public/${slug}/venue-map/sections/${sectionId}/tables`
        + `?reserved_at=${encodeURIComponent(params.reserved_at)}&party_size=${params.party_size}`,
      { auth: false },
    ),
};

/** Staff map editor. Gated server-side by role:owner,manager + feature:venue_map. */
export const venueMapApi = {
  config: () => api.get<ItemEnvelope<VenueMapStaffConfig>>("venue-map"),

  /** Upload or replace THE venue map (SVG, or PNG at least 1280x960). */
  uploadMap: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<ItemEnvelope<Record<string, unknown>>>("venue-map/svg", form);
  },

  removeMap: () => api.delete<null>("venue-map/svg"),

  /**
   * Save a section's outline. The server derives the bounding box, so callers
   * send vertices only. `null` clears the area and hides the section from guests.
   */
  saveArea: (sectionId: string, polygon: Point[] | null) =>
    api.put<ItemEnvelope<{ id: string; name: string; polygon: Point[] | null; bounds: Bounds | null }>>(
      `venue-map/sections/${sectionId}/area`,
      { polygon },
    ),

  /**
   * Bulk-save placements in the SVG's viewBox units. `map_position: null`
   * un-places a table, returning it to the editor's tray.
   */
  savePositions: (
    positions: Array<{
      id: string;
      map_position: {
        x: number;
        y: number;
        width?: number;
        height?: number;
        rotation?: number;
      } | null;
    }>,
  ) => api.post<ItemEnvelope<{ updated: number }>>("venue-map/tables/positions", { positions }),
};
