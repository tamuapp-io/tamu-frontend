"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Echo from "laravel-echo";
import Pusher from "pusher-js";

/** laravel-echo v2 declares `Echo<T extends keyof Broadcaster>` — plain `Echo` needs a broadcaster arg at type level */
type StaffReverbEcho = Echo<"reverb">;
import { getBackendOrigin } from "@/lib/api/client";
import { showBrowserNotification } from "@/lib/browser-notifications";
import { toast } from "@/components/ui/toaster";
import { reservationsKeys } from "@/lib/hooks/use-reservations";
import { useAuthStore } from "@/lib/store/auth-store";

const REVERB_KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? "";
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST ?? "localhost";
const REVERB_PORT = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080);
const REVERB_SCHEME =
  (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http") === "https" ? "https" : "http";

declare global {
  interface Window {
    Pusher?: typeof Pusher;
  }
}

interface ReservationBroadcastPayload {
  reservation?: {
    source?: string;
    guest?: { name?: string | null };
    party_size?: number;
  };
}

function notifyStaffNewBooking(payload: ReservationBroadcastPayload): void {
  const r = payload.reservation;
  if (!r) {
    return;
  }

  const covers =
    typeof r.party_size === "number" ? `${r.party_size} covers` : "New covers";
  const guest = r.guest?.name?.trim();
  const isOnline = r.source === "online";
  const title = isOnline ? "New online booking" : "New reservation";
  const description = guest ? `${guest} · ${covers}` : covers;

  toast.success(title, description);

  showBrowserNotification(title, {
    body: description,
    url: "/reservations",
  });
}

/**
 * Subscribes authenticated staff to tenant-scoped Reverb broadcasts so
 * live views refetch reservations when bookings land (guest site or APIs).
 */
export function ReservationRealtimeSubscriber() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const tenant = useAuthStore((s) => s.tenant);
  const hydrated = useAuthStore((s) => s.hydrated);
  const echoRef = useRef<StaffReverbEcho | null>(null);

  useEffect(() => {
    if (!hydrated || !token || !tenant?.id) {
      return;
    }

    if (!REVERB_KEY || typeof window === "undefined") {
      return;
    }

    const tenantId = tenant.id;
    let cancelled = false;
    /** React 18/19 Strict Mode runs mount→cleanup→mount; defer so the aborted socket is not noisy. */
    const connectTimer = window.setTimeout(() => {
      if (cancelled) return;

      window.Pusher = Pusher;

      const origin = getBackendOrigin();
      const useTls = REVERB_SCHEME === "https";
      const echo = new Echo({
        broadcaster: "reverb",
        key: REVERB_KEY,
        wsHost: REVERB_HOST,
        wsPort: REVERB_PORT,
        wssPort: REVERB_PORT,
        forceTLS: useTls,
        // Plain HTTP local Reverb — only `ws` avoids pusher-js trying `wss` first.
        enabledTransports: useTls ? ["wss"] : ["ws"],
        authEndpoint: `${origin}/broadcasting/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      });

      echoRef.current = echo;

      const channel = echo.private(`tenant.${tenantId}`);

      channel.listen(".ReservationBooked", (payload: ReservationBroadcastPayload) => {
        void queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
        void queryClient.invalidateQueries({ queryKey: ["walk-ins"] });
        notifyStaffNewBooking(payload);
      });
    }, 1);

    return () => {
      cancelled = true;
      window.clearTimeout(connectTimer);
      const echo = echoRef.current;
      if (echo) {
        echo.leave(`tenant.${tenantId}`);
        echo.disconnect();
        echoRef.current = null;
      }
    };
  }, [hydrated, token, tenant?.id, queryClient]);

  return null;
}
