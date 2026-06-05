"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dismissBrowserNotificationPrompt,
  getBrowserNotificationPermission,
  isBrowserNotificationPromptDismissed,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  resetBrowserNotificationPromptDismissed,
  type BrowserNotificationPermission,
} from "@/lib/browser-notifications";

export function useBrowserNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] =
    useState<BrowserNotificationPermission>("default");
  const [promptDismissed, setPromptDismissed] = useState(true);

  useEffect(() => {
    setSupported(isBrowserNotificationSupported());
    setPermission(getBrowserNotificationPermission());
    setPromptDismissed(isBrowserNotificationPromptDismissed());
  }, []);

  const refresh = useCallback(() => {
    setPermission(getBrowserNotificationPermission());
    setPromptDismissed(isBrowserNotificationPromptDismissed());
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await requestBrowserNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      resetBrowserNotificationPromptDismissed();
      setPromptDismissed(false);
    }
    return result;
  }, []);

  const dismissPrompt = useCallback(() => {
    dismissBrowserNotificationPrompt();
    setPromptDismissed(true);
  }, []);

  return {
    supported,
    permission,
    promptDismissed,
    canPrompt: supported && permission === "default" && !promptDismissed,
    isGranted: permission === "granted",
    isDenied: permission === "denied",
    requestPermission,
    dismissPrompt,
    refresh,
  };
}
