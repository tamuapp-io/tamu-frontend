const ENABLED_KEY = "tamu.notificationSounds.enabled";

export type NotificationSoundKind = "booking" | "whatsapp";

const SOUND_SRC: Record<NotificationSoundKind, string> = {
  booking: "/sounds/new-booking.mp3",
  whatsapp: "/sounds/whatsapp-message.mp3",
};

/** Max HTMLMediaElement volume — alerts should cut through a busy service floor. */
const PLAYBACK_VOLUME = 1;

const audioCache: Partial<Record<NotificationSoundKind, HTMLAudioElement>> = {};

export function areNotificationSoundsEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(ENABLED_KEY) !== "0";
}

export function setNotificationSoundsEnabled(enabled: boolean): void {
  window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

function getAudio(kind: NotificationSoundKind): HTMLAudioElement | null {
  if (typeof window === "undefined" || !areNotificationSoundsEnabled()) {
    return null;
  }

  if (!audioCache[kind]) {
    const audio = new Audio(SOUND_SRC[kind]);
    audio.preload = "auto";
    audio.volume = PLAYBACK_VOLUME;
    audioCache[kind] = audio;
  }

  return audioCache[kind] ?? null;
}

/**
 * Browsers block audio until the user interacts with the page. Call once after
 * the first click, keydown, or touch so booking / WhatsApp sounds can play.
 */
export function unlockNotificationSounds(): void {
  for (const kind of Object.keys(SOUND_SRC) as NotificationSoundKind[]) {
    const audio = getAudio(kind);
    if (!audio) {
      continue;
    }

    audio.volume = 0;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = PLAYBACK_VOLUME;
      })
      .catch(() => {
        audio.volume = PLAYBACK_VOLUME;
      });
  }
}

export function playNotificationSound(kind: NotificationSoundKind): void {
  const audio = getAudio(kind);
  if (!audio) {
    return;
  }

  audio.currentTime = 0;
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
