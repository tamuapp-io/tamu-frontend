"use client";

import { useEffect, useRef } from "react";
import {
  useWhatsappConversations,
  useWhatsappStatus,
} from "@/lib/hooks/use-whatsapp-inbox";
import { notifyStaffWhatsappMessage } from "@/lib/whatsapp-notifications";
import type { WhatsappConversation } from "@/lib/types";

type ConversationSnapshot = {
  unread: number;
};

function snapshotConversations(
  rows: WhatsappConversation[],
): Map<string, ConversationSnapshot> {
  return new Map(
    rows.map((row) => [row.id, { unread: row.unread_count }]),
  );
}

function conversationById(
  rows: WhatsappConversation[],
  id: string,
): WhatsappConversation | undefined {
  return rows.find((row) => row.id === id);
}

function activeConversationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window.location.pathname.startsWith("/messages")) {
    return null;
  }

  return new URLSearchParams(window.location.search).get("conversation");
}

function shouldNotifyForConversation(conversationId: string): boolean {
  const activeId = activeConversationId();
  return activeId == null || activeId !== conversationId;
}

/**
 * Polls the inbox and alerts staff when unread inbound messages increase.
 */
export function WhatsappInboxNotificationSubscriber() {
  const status = useWhatsappStatus();
  const configured = status.data?.configured === true;
  const conversations = useWhatsappConversations(configured);
  const previousRef = useRef<Map<string, ConversationSnapshot> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const rows = conversations.data;
    if (!configured || !rows) {
      return;
    }

    const current = snapshotConversations(rows);

    if (!initializedRef.current) {
      previousRef.current = current;
      initializedRef.current = true;
      return;
    }

    const previous = previousRef.current ?? new Map();
    let notified = false;

    for (const [id, row] of current) {
      if (notified) {
        break;
      }

      const prior = previous.get(id);
      const conversation = conversationById(rows, id);
      if (!conversation) {
        continue;
      }

      if (!prior) {
        if (row.unread > 0 && shouldNotifyForConversation(id)) {
          notifyStaffWhatsappMessage(conversation);
          notified = true;
        }
        continue;
      }

      if (row.unread > prior.unread && shouldNotifyForConversation(id)) {
        notifyStaffWhatsappMessage(conversation);
        notified = true;
      }
    }

    previousRef.current = current;
  }, [configured, conversations.data]);

  return null;
}
