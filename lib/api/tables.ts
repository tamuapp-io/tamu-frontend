import { api } from "@/lib/api/client";
import type {
  CreateTablePayload,
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
