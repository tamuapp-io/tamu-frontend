import { playWhatsappNotificationSound } from "@/lib/notification-sounds";
import { useStaffNotificationStore } from "@/lib/store/staff-notification-store";
import type { WhatsappConversation } from "@/lib/types";

function displayName(row: WhatsappConversation): string {
  return (
    row.contact_name?.trim() ||
    row.guest?.name?.trim() ||
    (row.phone_e164.startsWith("+") ? row.phone_e164 : `+${row.phone_e164}`)
  );
}

/** Sound + header notification list entry for a new inbound WhatsApp message. */
export function notifyStaffWhatsappMessage(conversation: WhatsappConversation): void {
  const title = displayName(conversation);
  const body = conversation.last_message_preview?.trim() || "New message";

  useStaffNotificationStore.getState().add({
    id: `whatsapp-${conversation.id}-${Date.now()}`,
    kind: "whatsapp",
    title,
    body,
    href: `/messages?conversation=${conversation.id}`,
  });

  playWhatsappNotificationSound();
}
