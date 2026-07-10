"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  roomsApi,
  servicesApi,
  therapistsApi,
  type CreateRoomPayload,
  type CreateServicePayload,
  type CreateTherapistPayload,
  type UpdateRoomPayload,
  type UpdateServicePayload,
  type UpdateTherapistPayload,
} from "@/lib/api/spa-catalog";

export const spaKeys = {
  services: ["spa", "services"] as const,
  therapists: ["spa", "therapists"] as const,
  rooms: ["spa", "rooms"] as const,
};

export function useServicesList() {
  return useQuery({
    queryKey: spaKeys.services,
    queryFn: async () => (await servicesApi.list()).data,
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateServicePayload) =>
      (await servicesApi.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.services }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateServicePayload }) =>
      (await servicesApi.update(id, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.services }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => servicesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.services }),
  });
}

export function useTherapistsList() {
  return useQuery({
    queryKey: spaKeys.therapists,
    queryFn: async () => (await therapistsApi.list()).data,
  });
}

export function useCreateTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTherapistPayload) =>
      (await therapistsApi.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.therapists }),
  });
}

export function useUpdateTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTherapistPayload }) =>
      (await therapistsApi.update(id, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.therapists }),
  });
}

export function useDeleteTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => therapistsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.therapists }),
  });
}

export function useRoomsList() {
  return useQuery({
    queryKey: spaKeys.rooms,
    queryFn: async () => (await roomsApi.list()).data,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRoomPayload) =>
      (await roomsApi.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.rooms }),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateRoomPayload }) =>
      (await roomsApi.update(id, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.rooms }),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => roomsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: spaKeys.rooms }),
  });
}
