import { api } from "@/lib/api/client";
import type { GuestProfile, ItemEnvelope, ListEnvelope, PaginationMeta } from "@/lib/types";

export async function fetchGuests(query: {
  q?: string;
  per_page?: number;
  page?: number;
}): Promise<{ data: GuestProfile[]; meta?: PaginationMeta }> {
  return api.get<ListEnvelope<GuestProfile>>("guests", { query });
}

export async function fetchGuestDetail(id: string): Promise<{ data: GuestProfile }> {
  return api.get<ItemEnvelope<GuestProfile>>(`guests/${id}`);
}

export async function updateGuestBlacklist(
  id: string,
  payload: { is_blacklisted: boolean },
): Promise<{ data: GuestProfile }> {
  return api.patch<ItemEnvelope<GuestProfile>>(`guests/${id}/blacklist`, payload);
}
