import { api } from "@/lib/api/client";
import type {
  ItemEnvelope,
  JoinWaitlistPayload,
  PublicAvailabilityResponse,
  PublicCreateReservationPayload,
  PublicReservation,
  PublicSpaCatalog,
  PublicTenant,
  RescheduleReservationPayload,
  WaitlistEntryPublic,
} from "@/lib/types";

/**
 * Public-facing booking API. These endpoints don't require auth
 * (the backend resolves the tenant from the slug in the URL).
 *
 * The api client will still try to send a bearer token if one is
 * stored — that's fine, the backend ignores it on these routes.
 */
export const publicBookingApi = {
  profile: (slug: string) =>
    api.get<ItemEnvelope<PublicTenant>>(`public/${slug}`, { auth: false }),

  catalog: (slug: string) =>
    api.get<ItemEnvelope<PublicSpaCatalog>>(`public/${slug}/catalog`, {
      auth: false,
    }),

  availability: (
    slug: string,
    query:
      | { date: string; party_size: number }
      | { date: string; service_id: string; therapist_id?: string },
  ) =>
    api.get<ItemEnvelope<PublicAvailabilityResponse>>(
      `public/${slug}/availability`,
      { query, auth: false },
    ),

  create: (slug: string, payload: PublicCreateReservationPayload) =>
    api.post<ItemEnvelope<PublicReservation>>(
      `public/${slug}/reservations`,
      payload,
      { auth: false },
    ),

  joinWaitlist: (slug: string, payload: JoinWaitlistPayload) =>
    api.post<ItemEnvelope<WaitlistEntryPublic>>(
      `public/${slug}/waitlist`,
      payload,
      { auth: false },
    ),

  show: (code: string) =>
    api.get<ItemEnvelope<PublicReservation>>(`public/reservations/${code}`, {
      auth: false,
    }),

  /**
   * Reconcile a pending deposit against the gateway. Used when the guest
   * returns from checkout so the booking confirms even if the webhook never
   * reaches us. Idempotent server-side.
   */
  refreshPayment: (code: string) =>
    api.post<ItemEnvelope<PublicReservation>>(
      `public/reservations/${code}/payment/refresh`,
      undefined,
      { auth: false },
    ),

  cancel: (code: string, reason?: string) =>
    api.delete<ItemEnvelope<PublicReservation>>(
      `public/reservations/${code}`,
      { auth: false, body: { reason } },
    ),

  modify: (code: string, payload: RescheduleReservationPayload) =>
    api.put<ItemEnvelope<PublicReservation>>(
      `public/reservations/${code}`,
      payload,
      { auth: false },
    ),
};
