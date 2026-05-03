"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  reservationsApi,
  type ListReservationsQuery,
  type StaffReservationTransition,
} from "@/lib/api/reservations";
import type {
  CreateReservationPayload,
  RescheduleReservationPayload,
} from "@/lib/types";

export const reservationsKeys = {
  all: ["reservations"] as const,
  list: (q: ListReservationsQuery) => [...reservationsKeys.all, "list", q] as const,
  detail: (id: string) => [...reservationsKeys.all, "detail", id] as const,
};

function invalidateReservationFeeds(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: reservationsKeys.all });
  void qc.invalidateQueries({ queryKey: ["walk-ins"] });
}

export function useReservationsList(query: ListReservationsQuery = {}) {
  return useQuery({
    queryKey: reservationsKeys.list(query),
    queryFn: async () => (await reservationsApi.list(query)),
  });
}

export function useReservation(id: string | null | undefined) {
  return useQuery({
    queryKey: reservationsKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async () => (await reservationsApi.get(id as string)).data,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateReservationPayload) =>
      (await reservationsApi.create(payload)).data,
    onSuccess: () => invalidateReservationFeeds(qc),
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await reservationsApi.cancel(id, reason)).data,
    onSuccess: () => invalidateReservationFeeds(qc),
  });
}

/**
 * Drive any state-machine transition (seat / complete / no-show /
 * cancelled / confirmed) through one mutation. Server enforces the
 * legal-transition matrix and returns 409 invalid_transition if not.
 */
export function useTransitionReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: StaffReservationTransition;
      reason?: string;
    }) => (await reservationsApi.transition(id, status, reason)).data,
    onSuccess: () => invalidateReservationFeeds(qc),
  });
}

export function useRescheduleReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: RescheduleReservationPayload;
    }) => (await reservationsApi.reschedule(id, payload)).data,
    onSuccess: () => invalidateReservationFeeds(qc),
  });
}

export function useReassignReservationTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, table_id }: { id: string; table_id: string }) =>
      (await reservationsApi.reassignTable(id, table_id)).data,
    onSuccess: () => invalidateReservationFeeds(qc),
  });
}

export function useAddReservationNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) =>
      (await reservationsApi.addNote(id, note)).data,
    onSuccess: () => invalidateReservationFeeds(qc),
  });
}
