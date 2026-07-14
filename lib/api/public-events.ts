import { api } from "@/lib/api/client";
import type {
  ItemEnvelope,
  ListEnvelope,
  PublicEvent,
  PurchaseTicketsPayload,
  TicketOrder,
} from "@/lib/types";

/**
 * Public, unauthenticated event-ticketing API. The backend resolves the
 * tenant from the slug in the URL; ticket lookups carry their own tenant
 * binding via the signed code.
 */
export const publicEventsApi = {
  list: (slug: string) =>
    api.get<ListEnvelope<PublicEvent>>(`public/${slug}/events`, { auth: false }),

  get: (slug: string, eventSlug: string) =>
    api.get<ItemEnvelope<PublicEvent>>(`public/${slug}/events/${eventSlug}`, {
      auth: false,
    }),

  purchase: (slug: string, eventSlug: string, payload: PurchaseTicketsPayload) =>
    api.post<ItemEnvelope<TicketOrder>>(
      `public/${slug}/events/${eventSlug}/purchase`,
      payload,
      { auth: false },
    ),

  ticket: (code: string) =>
    api.get<ItemEnvelope<TicketOrder>>(`public/tickets/${code}`, { auth: false }),

  /** Poll an order by id after a gateway redirect until tickets are issued. */
  order: (orderId: string) =>
    api.get<ItemEnvelope<TicketOrder>>(`public/orders/${orderId}`, {
      auth: false,
    }),

  /** Reconcile a pending payment against the gateway (webhook safety net). */
  refreshOrderPayment: (orderId: string) =>
    api.post<ItemEnvelope<TicketOrder>>(
      `public/orders/${orderId}/payment/refresh`,
      undefined,
      { auth: false },
    ),

  trackReferral: (code: string) =>
    api.get<ItemEnvelope<{ tracked: boolean }>>(`public/referrals/${code}/hit`, {
      auth: false,
    }),
};
