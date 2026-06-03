import { api } from "@/lib/api/client";
import type {
  ItemEnvelope,
  ListEnvelope,
  WhatsappConversation,
  WhatsappConversationDetail,
  WhatsappInboxStatus,
  WhatsappMessage,
} from "@/lib/types";

export async function fetchWhatsappStatus(): Promise<{ data: WhatsappInboxStatus }> {
  return api.get<ItemEnvelope<WhatsappInboxStatus>>("whatsapp/status");
}

export async function fetchWhatsappConversations(query?: {
  page?: number;
  per_page?: number;
}): Promise<{ data: WhatsappConversation[]; meta?: ListEnvelope<WhatsappConversation>["meta"] }> {
  return api.get<ListEnvelope<WhatsappConversation>>("whatsapp/conversations", { query });
}

export async function fetchWhatsappConversation(
  id: string,
): Promise<{ data: WhatsappConversationDetail }> {
  return api.get<ItemEnvelope<WhatsappConversationDetail>>(`whatsapp/conversations/${id}`);
}

export async function sendWhatsappMessage(
  conversationId: string,
  body: string,
): Promise<{ data: WhatsappMessage }> {
  return api.post<ItemEnvelope<WhatsappMessage>>(
    `whatsapp/conversations/${conversationId}/messages`,
    { body },
  );
}
