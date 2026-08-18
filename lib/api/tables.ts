import { api } from "@/lib/api/client";
import type {
  CreateTablePayload,
  FloorSection,
  ItemEnvelope,
  ListEnvelope,
  Table,
  UpdateTablePayload,
} from "@/lib/types";

export interface ListTablesQuery {
  status?: string;
  section?: string;
  online_bookable?: boolean;
  per_page?: number;
}

export const tablesApi = {
  list: (query: ListTablesQuery = {}) =>
    api.get<ListEnvelope<Table>>("tables", { query }),
  get: (id: string) => api.get<ItemEnvelope<Table>>(`tables/${id}`),
  create: (payload: CreateTablePayload) =>
    api.post<ItemEnvelope<Table>>("tables", payload),
  update: (id: string, payload: UpdateTablePayload) =>
    api.patch<ItemEnvelope<Table>>(`tables/${id}`, payload),
  remove: (id: string) => api.delete<void>(`tables/${id}`),
  updatePositions: (
    positions: Array<{
      id: string;
      pos_x?: number;
      pos_y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    }>,
  ) => api.post<ListEnvelope<Table>>("tables/positions", { positions }),
};

export const floorSectionsApi = {
  list: () => api.get<ListEnvelope<FloorSection>>("tables/sections"),
  create: (name: string) =>
    api.post<ItemEnvelope<FloorSection>>("tables/sections", { name }),
  update: (
    id: string,
    payload: {
      name?: string;
      is_active?: boolean;
      /** Guests may pick tables here (venue_map feature). Defaults false. */
      is_bookable_online?: boolean;
      /** TRUE cents (IDR × 100) — NOT services.price_cents' whole-rupiah convention. */
      default_price_cents?: number | null;
      description?: string | null;
    },
  ) => api.patch<ItemEnvelope<FloorSection>>(`tables/sections/${id}`, payload),
  remove: (id: string) => api.delete<void>(`tables/sections/${id}`),
  reorder: (ids: string[]) =>
    api.post<ListEnvelope<FloorSection>>("tables/sections/reorder", { ids }),
};
