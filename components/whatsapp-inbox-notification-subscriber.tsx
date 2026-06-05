"use client";

import { useEffect, useRef } from "react";
import {
  useWhatsappConversations,
  useWhatsappStatus,
} from "@/lib/hooks/use-whatsapp-inbox";
import { playWhatsappNotificationSound } from "@/lib/notification-sounds";
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

function activeConversationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window.location.pathname.startsWith("/messages")) {
    return null;
  }

  return new URLSearchParams(window.location.search).get("conversation");
}

function shouldPlayForConversation(conversationId: string): boolean {
  const activeId = activeConversationId();
  return activeId == null || activeId !== conversationId;
}

/**
 * Polls the inbox and plays the WhatsApp message sound when unread inbound
 * messages increase (skips the initial snapshot and the open thread).
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
    let played = false;

    for (const [id, row] of current) {
      if (played) {
        break;
      }

      const prior = previous.get(id);

      if (!prior) {
        if (row.unread > 0 && shouldPlayForConversation(id)) {
          playWhatsappNotificationSound();
          played = true;
        }
        continue;
      }

      if (row.unread > prior.unread && shouldPlayForConversation(id)) {
        playWhatsappNotificationSound();
        played = true;
      }
    }

    previousRef.current = current;
  }, [configured, conversations.data]);

  return null;
}
