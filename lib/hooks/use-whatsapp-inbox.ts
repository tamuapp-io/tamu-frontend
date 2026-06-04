import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearWhatsappConversation,
  fetchWhatsappConversation,
  fetchWhatsappConversations,
  fetchWhatsappStatus,
  openWhatsappConversation,
  sendWhatsappMessage,
} from "@/lib/api/whatsapp";
import type { WhatsappConversation, WhatsappConversationDetail } from "@/lib/types";

export function useWhatsappStatus() {
  return useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: async () => fetchWhatsappStatus().then((r) => r.data),
  });
}

export function useWhatsappConversations(enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp-conversations"],
    queryFn: async () => fetchWhatsappConversations({ per_page: 50 }).then((r) => r.data),
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useWhatsappConversation(conversationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp-conversation", conversationId],
    queryFn: async () =>
      fetchWhatsappConversation(conversationId!).then((r) => r.data),
    enabled: enabled && conversationId != null,
    refetchInterval: enabled && conversationId != null ? 10_000 : false,
  });
}

export function useSendWhatsappMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendWhatsappMessage(conversationId, body),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-conversation", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
  });
}

export function useClearWhatsappConversation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => clearWhatsappConversation(conversationId),
    onSuccess: (_res, conversationId) => {
      qc.removeQueries({ queryKey: ["whatsapp-conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
  });
}

export function useOpenWhatsappConversation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: { phone: string; guest_id?: string; name?: string }) =>
      openWhatsappConversation(payload),
    onSuccess: (res) => {
      const conversation = res.data;
      qc.setQueryData<WhatsappConversationDetail>(
        ["whatsapp-conversation", conversation.id],
        { conversation, messages: [] },
      );
      qc.setQueryData<WhatsappConversation[]>(["whatsapp-conversations"], (old) => {
        const list = old ?? [];
        if (list.some((row) => row.id === conversation.id)) {
          return list;
        }
        return [conversation, ...list];
      });
    },
  });
}
