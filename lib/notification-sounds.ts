const ENABLED_KEY = "tamu.notificationSounds.enabled";

export type NotificationSoundKind = "booking" | "whatsapp";

const SOUND_SRC: Record<NotificationSoundKind, string> = {
  booking: "/sounds/new-booking.mp3",
  whatsapp: "/sounds/whatsapp-message.mp3",
};

/** Max HTMLMediaElement volume — alerts should cut through a busy service floor. */
const PLAYBACK_VOLUME = 1;

export function areNotificationSoundsEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(ENABLED_KEY) !== "0";
}

export function setNotificationSoundsEnabled(enabled: boolean): void {
  window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

function createAudio(kind: NotificationSoundKind): HTMLAudioElement {
  const audio = new Audio(SOUND_SRC[kind]);
  audio.preload = "auto";
  audio.volume = PLAYBACK_VOLUME;
  return audio;
}

/**
 * Browsers block audio until the user interacts with the page. Call once after
 * the first click, keydown, or touch so booking / WhatsApp sounds can play.
 */
export function unlockNotificationSounds(): void {
  for (const kind of Object.keys(SOUND_SRC) as NotificationSoundKind[]) {
    const audio = createAudio(kind);
    audio.volume = 0;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {
        // Ignore — unlock retried on next gesture.
      });
  }
}

export function playNotificationSound(kind: NotificationSoundKind): void {
  if (typeof window === "undefined" || !areNotificationSoundsEnabled()) {
    return;
  }

  const audio = createAudio(kind);
  void audio.play().catch(() => {
    // Still locked or tab muted — unlock runs on next user gesture.
  });
}

export function playBookingNotificationSound(): void {
  playNotificationSound("booking");
}

export function playWhatsappNotificationSound(): void {
  playNotificationSound("whatsapp");
}
