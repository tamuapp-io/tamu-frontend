import { api } from "@/lib/api/client";
import type {
  CreateReservationPayload,
  ItemEnvelope,
  ListEnvelope,
  Reservation,
  ReservationSource,
  ReservationStatus,
  RescheduleReservationPayload,
} from "@/lib/types";

export interface ListReservationsQuery {
  status?: ReservationStatus;
  date?: string; // YYYY-MM-DD
  table_id?: string;
  source?: ReservationSource;
  per_page?: number;
}

/**
 * Status transitions the staff API accepts (mirrors the backend
 * ReservationStateMachine ALLOWED matrix; the server rejects anything
 * else with 409 invalid_transition).
 */
export type StaffReservationTransition =
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export const reservationsApi = {
  list: (query: ListReservationsQuery = {}) =>
    api.get<ListEnvelope<Reservation>>("reservations", { query }),
  get: (id: string) => api.get<ItemEnvelope<Reservation>>(`reservations/${id}`),
  create: (payload: CreateReservationPayload) =>
    api.post<ItemEnvelope<Reservation>>("reservations", payload),
  cancel: (id: string, reason?: string) =>
    api.post<ItemEnvelope<Reservation>>(`reservations/${id}/cancel`, {
      reason,
    }),
  transition: (id: string, status: StaffReservationTransition, reason?: string) =>
    api.patch<ItemEnvelope<Reservation>>(`reservations/${id}/status`, {
      status,
      reason,
    }),
  reschedule: (id: string, payload: RescheduleReservationPayload) =>
    api.put<ItemEnvelope<Reservation>>(`reservations/${id}`, payload),
  reassignTable: (id: string, table_id: string) =>
    api.patch<ItemEnvelope<Reservation>>(`reservations/${id}/table`, {
      table_id,
    }),
  addNote: (id: string, note: string) =>
    api.post<ItemEnvelope<Reservation>>(`reservations/${id}/notes`, { note }),
};
