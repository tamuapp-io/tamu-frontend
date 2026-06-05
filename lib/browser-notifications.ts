const DISMISS_KEY = "tamu.browserNotifications.promptDismissed";

export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!isBrowserNotificationSupported()) {
    return "unsupported";
  }

  return Notification.permission;
}

export function isBrowserNotificationPromptDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissBrowserNotificationPrompt(): void {
  window.localStorage.setItem(DISMISS_KEY, "1");
}

export function resetBrowserNotificationPromptDismissed(): void {
  window.localStorage.removeItem(DISMISS_KEY);
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!isBrowserNotificationSupported()) {
    return "unsupported";
  }

  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions & { url?: string },
): void {
  if (!isBrowserNotificationSupported() || Notification.permission !== "granted") {
    return;
  }

  const { url, ...notificationOptions } = options ?? {};

  try {
    const notification = new Notification(title, {
      ...notificationOptions,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (url) {
        window.location.assign(url);
      }
    };
  } catch {
    // Some browsers block notifications outside a secure context.
  }
}

/** True when the API is remote but Reverb still points at localhost — WS will fail. */
export function isReverbHostMisconfigured(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
    const apiHost = new URL(apiUrl.replace(/\/api\/v1\/?$/i, "")).hostname;
    const reverbHost = process.env.NEXT_PUBLIC_REVERB_HOST ?? "localhost";

    return (
      (reverbHost === "localhost" || reverbHost === "127.0.0.1") &&
      apiHost !== "localhost" &&
      apiHost !== "127.0.0.1"
    );
  } catch {
    return false;
  }
}
