import { showBrowserNotification } from "@/lib/browser-notifications";
import { playBookingNotificationSound } from "@/lib/notification-sounds";
import { useBookingNotificationStore } from "@/lib/store/booking-notification-store";
import { useStaffNotificationStore } from "@/lib/store/staff-notification-store";
import { toast } from "@/components/ui/toaster";

export interface ReservationBroadcastPayload {
  reservation?: {
    id?: string;
    source?: string;
    guest?: { name?: string | null };
    party_size?: number;
  };
}

const seenBookingIds = new Set<string>();

/** Avoid duplicate toasts when Reverb reconnects or the event is replayed. */
function isDuplicateBooking(reservationId: string | undefined): boolean {
  if (!reservationId) {
    return false;
  }

  if (seenBookingIds.has(reservationId)) {
    return true;
  }

  seenBookingIds.add(reservationId);

  if (seenBookingIds.size > 200) {
    const oldest = seenBookingIds.values().next().value;
    if (oldest) {
      seenBookingIds.delete(oldest);
    }
  }

  return false;
}

/** Toast, browser notification, and sidebar badge for a new reservation. */
export function notifyStaffNewBooking(payload: ReservationBroadcastPayload): void {
  const r = payload.reservation;
  if (!r) {
    return;
  }

  if (isDuplicateBooking(r.id)) {
    return;
  }

  const covers =
    typeof r.party_size === "number" ? `${r.party_size} covers` : "New covers";
  const guest = r.guest?.name?.trim();
  const isOnline = r.source === "online";
  const title = isOnline ? "New online booking" : "New reservation";
  const description = guest ? `${guest} · ${covers}` : covers;

  useBookingNotificationStore.getState().signalNewBooking();
  useStaffNotificationStore.getState().add({
    id: r.id ? `booking-${r.id}` : `booking-${Date.now()}`,
    kind: "booking",
    title,
    body: description,
    href: "/live",
  });
  playBookingNotificationSound();
  toast.success(title, description);

  showBrowserNotification(title, {
    body: description,
    url: "/live",
  });
}
