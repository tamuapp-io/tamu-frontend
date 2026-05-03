import { api } from "@/lib/api/client";
import type { AvailabilityResponse, ItemEnvelope } from "@/lib/types";

export const availabilityApi = {
  get: (params: { date: string; party_size: number }) =>
    api.get<ItemEnvelope<AvailabilityResponse>>("availability", { query: params }),
};
