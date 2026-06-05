"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  areNotificationSoundsEnabled,
  playBookingNotificationSound,
  playWhatsappNotificationSound,
  setNotificationSoundsEnabled,
  unlockNotificationSounds,
} from "@/lib/notification-sounds";

export function StaffNotificationSoundsSettings() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(areNotificationSoundsEnabled());
  }, []);

  function handleToggle(checked: boolean) {
    setNotificationSoundsEnabled(checked);
    setEnabled(checked);
    if (checked) {
      unlockNotificationSounds();
    }
  }

  function previewBookingSound() {
    unlockNotificationSounds();
    playBookingNotificationSound();
  }

  function previewWhatsappSound() {
    unlockNotificationSounds();
    playWhatsappNotificationSound();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            {enabled ? (
              <Volume2 className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <VolumeX className="size-4 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div>
            <Label htmlFor="notification-sounds" className="text-sm font-semibold">
              In-app alert sounds
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Louder coin-style chime for new bookings and a double chat tone for
              new WhatsApp messages while Tamu is open.
            </p>
          </div>
        </div>
        <Switch
          id="notification-sounds"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={previewBookingSound}>
          Test booking sound
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={previewWhatsappSound}>
          Test WhatsApp sound
        </Button>
      </div>
    </div>
  );
}
