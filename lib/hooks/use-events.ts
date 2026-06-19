"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi, type ListBuyersQuery, type ListEventsQuery } from "@/lib/api/events";
import type {
  CreateEventPayload,
  CreateReferralPayload,
  TicketTypePayload,
  UpdateEventPayload,
} from "@/lib/types";

export const eventsKeys = {
  all: ["events"] as const,
  list: (q: ListEventsQuery) => [...eventsKeys.all, "list", q] as const,
  detail: (id: string) => [...eventsKeys.all, "detail", id] as const,
  report: (id: string) => [...eventsKeys.all, "report", id] as const,
  referrals: (id: string) => [...eventsKeys.all, "referrals", id] as const,
  tickets: (id: string) => [...eventsKeys.all, "tickets", id] as const,
  buyers: (id: string, q: ListBuyersQuery) =>
    [...eventsKeys.all, "buyers", id, q] as const,
  attendees: (q: ListBuyersQuery & { event_id?: string }) =>
    [...eventsKeys.all, "attendees", q] as const,
  reportSummary: () => [...eventsKeys.all, "report-summary"] as const,
};

export function useEventsList(query: ListEventsQuery = {}) {
  return useQuery({
    queryKey: eventsKeys.list(query),
    queryFn: async () => eventsApi.list(query),
  });
}

export function useEvent(id: string | null | undefined) {
  return useQuery({
    queryKey: eventsKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => (await eventsApi.get(id as string)).data,
  });
}

export function useEventReport(id: string | null | undefined) {
  return useQuery({
    queryKey: eventsKeys.report(id ?? ""),
    enabled: !!id,
    queryFn: async () => (await eventsApi.report(id as string)).data,
  });
}

export function useEventReferrals(id: string | null | undefined) {
  return useQuery({
    queryKey: eventsKeys.referrals(id ?? ""),
    enabled: !!id,
    queryFn: async () => (await eventsApi.listReferrals(id as string)).data,
  });
}

export function useEventBuyers(
  id: string | null | undefined,
  query: ListBuyersQuery = {},
) {
  return useQuery({
    queryKey: eventsKeys.buyers(id ?? "", query),
    enabled: !!id,
    queryFn: async () => eventsApi.buyers(id as string, query),
  });
}

export function useEventAttendees(
  query: ListBuyersQuery & { event_id?: string } = {},
) {
  return useQuery({
    queryKey: eventsKeys.attendees(query),
    queryFn: async () => eventsApi.attendees(query),
  });
}

export function useEventReportSummary() {
  return useQuery({
    queryKey: eventsKeys.reportSummary(),
    queryFn: async () => (await eventsApi.reportSummary()).data,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEventPayload) =>
      (await eventsApi.create(payload)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: eventsKeys.all }),
  });
}

export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateEventPayload) =>
      (await eventsApi.update(id, payload)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventsKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: eventsKeys.all });
    },
  });
}

export function useEventLifecycle(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: eventsKeys.detail(id) });
    void qc.invalidateQueries({ queryKey: eventsKeys.all });
  };
  return {
    publish: useMutation({
      mutationFn: async () => (await eventsApi.publish(id)).data,
      onSuccess: invalidate,
    }),
    unpublish: useMutation({
      mutationFn: async () => (await eventsApi.unpublish(id)).data,
      onSuccess: invalidate,
    }),
  };
}

export function useTicketTypeMutations(eventId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: eventsKeys.detail(eventId) });

  return {
    create: useMutation({
      mutationFn: async (payload: TicketTypePayload) =>
        (await eventsApi.createTicketType(eventId, payload)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, payload }: { id: string; payload: Partial<TicketTypePayload> }) =>
        (await eventsApi.updateTicketType(id, payload)).data,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => eventsApi.deleteTicketType(id),
      onSuccess: invalidate,
    }),
  };
}

export function useCreateReferral(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateReferralPayload) =>
      (await eventsApi.createReferral(eventId, payload)).data,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: eventsKeys.referrals(eventId) }),
  });
}

export function useCheckInTicket() {
  return useMutation({
    mutationFn: async (code: string) => eventsApi.checkIn(code),
  });
}
