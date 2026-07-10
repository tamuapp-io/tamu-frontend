import { api } from "@/lib/api/client";
import type {
  ItemEnvelope,
  ListEnvelope,
  SpaRoom,
  SpaService,
  Therapist,
} from "@/lib/types";

export interface CreateServicePayload {
  name: string;
  description?: string | null;
  duration_mins: number;
  price_cents?: number;
  currency?: string;
  is_active?: boolean;
  display_order?: number;
  therapist_ids?: string[];
}

export type UpdateServicePayload = Partial<CreateServicePayload>;

export interface CreateTherapistPayload {
  name: string;
  bio?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  display_order?: number;
  service_ids?: string[];
}

export type UpdateTherapistPayload = Partial<CreateTherapistPayload>;

export interface CreateRoomPayload {
  name: string;
  is_active?: boolean;
  display_order?: number;
}

export type UpdateRoomPayload = Partial<CreateRoomPayload>;

export const servicesApi = {
  list: () => api.get<ListEnvelope<SpaService>>("services"),
  get: (id: string) => api.get<ItemEnvelope<SpaService>>(`services/${id}`),
  create: (payload: CreateServicePayload) =>
    api.post<ItemEnvelope<SpaService>>("services", payload),
  update: (id: string, payload: UpdateServicePayload) =>
    api.patch<ItemEnvelope<SpaService>>(`services/${id}`, payload),
  remove: (id: string) => api.delete<void>(`services/${id}`),
};

export const therapistsApi = {
  list: () => api.get<ListEnvelope<Therapist>>("therapists"),
  get: (id: string) => api.get<ItemEnvelope<Therapist>>(`therapists/${id}`),
  create: (payload: CreateTherapistPayload) =>
    api.post<ItemEnvelope<Therapist>>("therapists", payload),
  update: (id: string, payload: UpdateTherapistPayload) =>
    api.patch<ItemEnvelope<Therapist>>(`therapists/${id}`, payload),
  remove: (id: string) => api.delete<void>(`therapists/${id}`),
};

export const roomsApi = {
  list: () => api.get<ListEnvelope<SpaRoom>>("rooms"),
  get: (id: string) => api.get<ItemEnvelope<SpaRoom>>(`rooms/${id}`),
  create: (payload: CreateRoomPayload) =>
    api.post<ItemEnvelope<SpaRoom>>("rooms", payload),
  update: (id: string, payload: UpdateRoomPayload) =>
    api.patch<ItemEnvelope<SpaRoom>>(`rooms/${id}`, payload),
  remove: (id: string) => api.delete<void>(`rooms/${id}`),
};
