"use client";

import { Bell, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { isReverbHostMisconfigured } from "@/lib/browser-notifications";
import { useBrowserNotifications } from "@/lib/hooks/use-browser-notifications";

/**
 * Asks staff to allow Chrome/Safari desktop notifications for new bookings.
 * Browsers require a click before showing the native permission dialog.
 */
export function BrowserNotificationPrompt() {
  const { supported, canPrompt, isDenied, requestPermission, dismissPrompt } =
    useBrowserNotifications();
  const [requesting, setRequesting] = useState(false);
  const reverbMisconfigured = isReverbHostMisconfigured();

  if (!supported || (!canPrompt && !isDenied && !reverbMisconfigured)) {
    return null;
  }

  async function handleEnable() {
    setRequesting(true);
    try {
      const result = await requestPermission();
      if (result === "granted") {
        toast.success("Browser notifications enabled");
      } else if (result === "denied") {
        toast.error(
          "Notifications blocked",
          "Allow notifications for this site in your browser settings, then try again.",
        );
      }
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-lg flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-lg">
        {reverbMisconfigured ? (
          <p className="text-sm text-amber-950 dark:text-amber-100">
            Live booking alerts are offline: your API uses a remote host but Reverb is set to{" "}
            <code className="text-xs">localhost</code>. Point{" "}
            <code className="text-xs">NEXT_PUBLIC_REVERB_HOST</code> at a reachable WebSocket
            URL and run <code className="text-xs">php artisan reverb:start</code>.
          </p>
        ) : null}

        {canPrompt ? (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Enable booking alerts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Get Chrome or Safari notifications when a new reservation arrives, even when
                Tamu is in the background.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={requesting} onClick={handleEnable}>
                  Allow notifications
                </Button>
                <Button size="sm" variant="ghost" onClick={dismissPrompt}>
                  Not now
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Dismiss"
              onClick={dismissPrompt}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}

        {isDenied && !canPrompt ? (
          <p className="text-sm text-muted-foreground">
            Browser notifications are blocked. Open your browser site settings for Tamu and
            allow notifications, then reload this page.
          </p>
        ) : null}
      </div>
    </div>
  );
}
