import { api } from "@/lib/api/client";
import type {
  CampaignPreview,
  CampaignSummary,
  CrmAudience,
  CrmAutomations,
  CrmConnection,
  CrmConnectionsMap,
  CrmOverview,
  CrmProviderKey,
  GuestProfile,
  ItemEnvelope,
  ListEnvelope,
  PaginationMeta,
} from "@/lib/types";

export async function fetchCrmOverview(): Promise<{ data: CrmOverview }> {
  return api.get<{ data: CrmOverview }>("crm/overview");
}

export async function fetchCrmContacts(query: {
  segment?: string;
  q?: string;
  per_page?: number;
  page?: number;
}): Promise<{ data: GuestProfile[]; meta?: PaginationMeta }> {
  return api.get<ListEnvelope<GuestProfile>>("crm/contacts", { query });
}

export async function fetchCrmConnections(): Promise<{ data: CrmConnectionsMap }> {
  return api.get<{ data: CrmConnectionsMap }>("crm/connections");
}

export async function connectCrmProvider(
  provider: CrmProviderKey,
  payload: { api_key: string; list_id?: string; list_name?: string },
): Promise<{ data: CrmConnection }> {
  return api.put<{ data: CrmConnection }>(`crm/connections/${provider}`, payload);
}

export async function disconnectCrmProvider(
  provider: CrmProviderKey,
): Promise<{ data: CrmConnection }> {
  return api.delete<{ data: CrmConnection }>(`crm/connections/${provider}`);
}

export async function fetchCrmAudiences(
  provider: CrmProviderKey,
): Promise<{ data: CrmAudience[] }> {
  return api.get<{ data: CrmAudience[] }>(`crm/connections/${provider}/audiences`);
}

export async function syncCrmProvider(
  provider: CrmProviderKey,
  payload: { segment?: string; list_id?: string },
): Promise<{ data: CrmConnection }> {
  return api.post<{ data: CrmConnection }>(`crm/connections/${provider}/sync`, payload);
}

/* Campaigns ------------------------------------------------------------- */

export async function fetchCampaigns(): Promise<{ data: CampaignSummary[]; meta?: PaginationMeta }> {
  return api.get<ListEnvelope<CampaignSummary>>("crm/campaigns", { query: { per_page: 50 } });
}

export async function previewCampaign(segment: string): Promise<{ data: CampaignPreview }> {
  return api.get<{ data: CampaignPreview }>("crm/campaigns/preview", { query: { segment } });
}

export async function createCampaign(payload: {
  name: string;
  segment: string;
  message_body: string;
}): Promise<{ data: CampaignSummary }> {
  return api.post<{ data: CampaignSummary }>("crm/campaigns", payload);
}

export async function sendCampaign(id: string): Promise<{ data: CampaignSummary }> {
  return api.post<{ data: CampaignSummary }>(`crm/campaigns/${id}/send`);
}

/* Automations ----------------------------------------------------------- */

export async function fetchAutomations(): Promise<{ data: CrmAutomations }> {
  return api.get<{ data: CrmAutomations }>("crm/automations");
}

export async function updateAutomations(
  patch: Partial<{
    birthday: Partial<CrmAutomations["birthday"]>;
    winback: Partial<CrmAutomations["winback"]>;
  }>,
): Promise<{ data: CrmAutomations }> {
  return api.patch<{ data: CrmAutomations }>("crm/automations", patch);
}

/* Consent --------------------------------------------------------------- */

export async function updateContactConsent(
  id: string,
  payload: { whatsapp_consent?: boolean; email_consent?: boolean },
): Promise<{ data: GuestProfile }> {
  return api.patch<ItemEnvelope<GuestProfile>>(`guests/${id}`, payload);
}

export async function updateContactBirthday(
  id: string,
  payload: { birthday_month: number | null; birthday_day: number | null },
): Promise<{ data: GuestProfile }> {
  return api.patch<ItemEnvelope<GuestProfile>>(`guests/${id}`, payload);
}
