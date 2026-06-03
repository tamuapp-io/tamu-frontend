import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWhatsappConversation,
  fetchWhatsappConversations,
  fetchWhatsappStatus,
  sendWhatsappMessage,
} from "@/lib/api/whatsapp";

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
