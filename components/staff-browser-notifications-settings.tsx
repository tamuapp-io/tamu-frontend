"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { isReverbHostMisconfigured } from "@/lib/browser-notifications";
import { useBrowserNotifications } from "@/lib/hooks/use-browser-notifications";

export function StaffBrowserNotificationsSettings() {
  const { supported, permission, isGranted, isDenied, requestPermission, refresh } =
    useBrowserNotifications();
  const [requesting, setRequesting] = useState(false);
  const reverbMisconfigured = isReverbHostMisconfigured();

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        This browser does not support desktop notifications.
      </p>
    );
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
          "Allow notifications in your browser settings for this site.",
        );
      }
    } finally {
      setRequesting(false);
    }
  }

  const statusLabel =
    permission === "granted"
      ? "Enabled"
      : permission === "denied"
        ? "Blocked by browser"
        : "Not enabled yet";

  const StatusIcon = isGranted ? BellRing : isDenied ? BellOff : Bell;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <StatusIcon className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold">Desktop booking alerts</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Show native Chrome or Safari notifications when a new reservation arrives.
              Tamu must stay open in a browser tab (background is fine).
            </p>
            <p className="mt-2 text-xs font-medium text-foreground">{statusLabel}</p>
          </div>
        </div>
        {!isGranted ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={requesting || isDenied}
            onClick={handleEnable}
          >
            Allow notifications
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            Refresh status
          </Button>
        )}
      </div>

      {isDenied ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Notifications were denied. In Chrome: click the lock icon in the address bar →
          Site settings → Notifications → Allow. In Safari: Settings → Websites → Notifications.
        </p>
      ) : null}

      {reverbMisconfigured ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-950 dark:text-amber-100">
          Alerts also need a working live connection. Your API URL is remote but Reverb is
          configured for localhost — update{" "}
          <code className="text-[11px]">NEXT_PUBLIC_REVERB_HOST</code> in{" "}
          <code className="text-[11px]">.env.local</code>.
        </p>
      ) : null}
    </div>
  );
}
