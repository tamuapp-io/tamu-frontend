"use client";

import { useSyncExternalStore } from "react";

function detectAppleClient(): boolean {
  const platform = navigator.platform ?? "";
  const ua = navigator.userAgent;
  return (
    /^(Mac|iPhone|iPad|iPod)/i.test(platform) || /Mac OS X/.test(ua)
  );
}

function readModKLabel(): string {
  return detectAppleClient() ? "⌘K" : "Ctrl+K";
}

/**
 * Shortcut label for the command palette: ⌘K on Apple platforms, Ctrl+K on Windows/Linux.
 */
export function useModKLabel(): string {
  return useSyncExternalStore(
    () => () => {},
    readModKLabel,
    () => "Ctrl+K",
  );
}
