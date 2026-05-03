import { api } from "@/lib/api/client";
import type { ItemEnvelope, Reservation, WaitlistEntryPublic } from "@/lib/types";

export async function fetchWaitlistForDate(date: string): Promise<{ data: WaitlistEntryPublic[] }> {
  return api.get<{ data: WaitlistEntryPublic[] }>("waitlist", { query: { date } });
}

export async function promoteWaitlistEntry(
  id: string,
  body: { table_id?: string | null; combination_id?: string | null } = {},
): Promise<{ data: Reservation }> {
  return api.post<ItemEnvelope<Reservation>>(`waitlist/${id}/promote`, body);
}

export async function removeWaitlistEntry(id: string): Promise<void> {
  await api.delete(`waitlist/${id}`);
}
