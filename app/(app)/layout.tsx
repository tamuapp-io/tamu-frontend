"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCurrentUser } from "@/lib/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppCommandPalette } from "@/components/app-command-palette";
import { BrowserNotificationPrompt } from "@/components/browser-notification-prompt";
import { ReservationRealtimeSubscriber } from "@/components/reservation-realtime-subscriber";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  // Validate the persisted token on mount; if it has been revoked the
  // /me request will return 401 and the api client will clear the store,
  // which redirects below.
  useCurrentUser();

  useEffect(() => {
    if (!hydrated) return;
    if (!token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className="flex min-h-svh bg-card">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <ReservationRealtimeSubscriber />
      <BrowserNotificationPrompt />
      <AppCommandPalette />
    </div>
  );
}
