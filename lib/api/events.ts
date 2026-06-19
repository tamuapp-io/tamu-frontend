import { api } from "@/lib/api/client";
import type {
  CreateEventPayload,
  CreateReferralPayload,
  EventModel,
  EventReferral,
  EventReport,
  EventReportSummary,
  ItemEnvelope,
  ListEnvelope,
  Ticket,
  TicketOrder,
  TicketType,
  TicketTypePayload,
  UpdateEventPayload,
} from "@/lib/types";

export interface ListEventsQuery {
  q?: string;
  status?: string;
  per_page?: number;
}

export interface ListBuyersQuery {
  q?: string;
  status?: string;
  per_page?: number;
}

/** Staff (authenticated) event-ticketing API. */
export const eventsApi = {
  list: (query: ListEventsQuery = {}) =>
    api.get<ListEnvelope<EventModel>>("events", { query }),
  get: (id: string) => api.get<ItemEnvelope<EventModel>>(`events/${id}`),
  create: (payload: CreateEventPayload) =>
    api.post<ItemEnvelope<EventModel>>("events", payload),
  update: (id: string, payload: UpdateEventPayload) =>
    api.patch<ItemEnvelope<EventModel>>(`events/${id}`, payload),
  remove: (id: string) => api.delete<void>(`events/${id}`),
  publish: (id: string) => api.post<ItemEnvelope<EventModel>>(`events/${id}/publish`),
  unpublish: (id: string) =>
    api.post<ItemEnvelope<EventModel>>(`events/${id}/unpublish`),

  report: (id: string) => api.get<ItemEnvelope<EventReport>>(`events/${id}/report`),
  tickets: (id: string, query: { status?: string; per_page?: number } = {}) =>
    api.get<ListEnvelope<Ticket>>(`events/${id}/tickets`, { query }),
  buyers: (id: string, query: ListBuyersQuery = {}) =>
    api.get<ListEnvelope<TicketOrder>>(`events/${id}/buyers`, { query }),

  createTicketType: (eventId: string, payload: TicketTypePayload) =>
    api.post<ItemEnvelope<TicketType>>(`events/${eventId}/ticket-types`, payload),
  updateTicketType: (id: string, payload: Partial<TicketTypePayload>) =>
    api.patch<ItemEnvelope<TicketType>>(`ticket-types/${id}`, payload),
  deleteTicketType: (id: string) => api.delete<void>(`ticket-types/${id}`),

  listReferrals: (eventId: string) =>
    api.get<ListEnvelope<EventReferral>>(`events/${eventId}/referrals`),
  createReferral: (eventId: string, payload: CreateReferralPayload) =>
    api.post<ItemEnvelope<EventReferral>>(`events/${eventId}/referrals`, payload),

  checkIn: (code: string) =>
    api.post<ItemEnvelope<Ticket>>("tickets/check-in", { code }),

  attendees: (query: ListBuyersQuery & { event_id?: string } = {}) =>
    api.get<ListEnvelope<TicketOrder>>("events/attendees", { query }),

  reportSummary: () =>
    api.get<ItemEnvelope<EventReportSummary>>("reports/events"),

  uploadImage: (file: File, folder: "events" | "events/covers" | "events/blocks" = "events") => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    return api.upload<ItemEnvelope<{ url: string; path: string; disk: string }>>(
      "uploads/image",
      form,
    );
  },
};
