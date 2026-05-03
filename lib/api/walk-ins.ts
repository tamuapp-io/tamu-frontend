import { api } from "@/lib/api/client";
import type {
  ListEnvelope,
  PaginationMeta,
  Reservation,
  ReservationStatus,
  WalkInLedgerSummary,
} from "@/lib/types";

export interface ListWalkInsQuery {
  date?: string;
  status?: ReservationStatus;
  per_page?: number;
}

export type WalkInsResponse = Omit<ListEnvelope<Reservation>, "meta"> & {
  meta: PaginationMeta & { walk_in_summary: WalkInLedgerSummary };
};

export const walkInsApi = {
  list: (query: ListWalkInsQuery = {}) =>
    api.get<WalkInsResponse>("walk-ins", { query }),
};
