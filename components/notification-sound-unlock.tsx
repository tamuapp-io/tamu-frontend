"use client";

import { useEffect } from "react";
import { unlockNotificationSounds } from "@/lib/notification-sounds";

/**
 * Unlocks HTML5 audio after the first user gesture so notification sounds
 * can play when bookings or WhatsApp messages arrive later.
 */
export function NotificationSoundUnlock() {
  useEffect(() => {
    let unlocked = false;

    const unlock = () => {
      if (unlocked) {
        return;
      }

      unlocked = true;
      unlockNotificationSounds();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
