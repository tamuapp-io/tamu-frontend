import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearWhatsappConversation,
  fetchWhatsappConversation,
  fetchWhatsappConversations,
  fetchWhatsappStatus,
  openWhatsappConversation,
  sendWhatsappMessage,
} from "@/lib/api/whatsapp";
import type {
  WhatsappConversation,
  WhatsappConversationDetail,
  WhatsappMessage,
} from "@/lib/types";

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

/** True when any inbox thread has unread inbound messages (for sidebar badge). */
export function useWhatsappHasUnread() {
  const status = useWhatsappStatus();
  const configured = status.data?.configured === true;
  const conversations = useWhatsappConversations(configured);

  const hasUnread = (conversations.data ?? []).some((row) => row.unread_count > 0);

  return { hasUnread, configured };
}

export function useWhatsappConversation(conversationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp-conversation", conversationId],
    queryFn: async () =>
      fetchWhatsappConversation(conversationId!).then((r) => r.data),
    enabled: enabled && conversationId != null,
    refetchInterval: (query) => {
      if (!enabled || conversationId == null) {
        return false;
      }

      const hasPending = (query.state.data?.messages ?? []).some(
        (m) =>
          m.direction === "outbound" &&
          (m.status === "pending" || m.status == null),
      );

      return hasPending ? 2_000 : 10_000;
    },
  });
}

type SendContext = {
  previous: WhatsappConversationDetail | undefined;
  conversationId: string;
  tempId: string;
};

export function useSendWhatsappMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendWhatsappMessage(conversationId, body),
    onMutate: async ({ conversationId, body }) => {
      await qc.cancelQueries({ queryKey: ["whatsapp-conversation", conversationId] });

      const previous = qc.getQueryData<WhatsappConversationDetail>([
        "whatsapp-conversation",
        conversationId,
      ]);

      const tempId = `optimistic-${Date.now()}`;
      const optimistic: WhatsappMessage = {
        id: tempId,
        conversation_id: conversationId,
        direction: "outbound",
        body,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      if (previous) {
        qc.setQueryData<WhatsappConversationDetail>(
          ["whatsapp-conversation", conversationId],
          {
            ...previous,
            messages: [...previous.messages, optimistic],
          },
        );
      }

      return { previous, conversationId, tempId } satisfies SendContext;
    },
    onSuccess: (res, vars, context) => {
      qc.setQueryData<WhatsappConversationDetail>(
        ["whatsapp-conversation", vars.conversationId],
        (old) => {
          if (!old) {
            return old;
          }

          const tempId = context?.tempId;
          const withoutTemp = tempId
            ? old.messages.filter((m) => m.id !== tempId)
            : old.messages;
          const serverMsg = res.data;
          const exists = withoutTemp.some((m) => m.id === serverMsg.id);

          return {
            ...old,
            messages: exists ? withoutTemp : [...withoutTemp, serverMsg],
          };
        },
      );
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        qc.setQueryData(
          ["whatsapp-conversation", vars.conversationId],
          context.previous,
        );
      }
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
