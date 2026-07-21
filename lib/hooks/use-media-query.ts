"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media-query subscription via useSyncExternalStore — the idiomatic
 * way to read an external browser store. Returns false on the server (and the
 * first client render), then the real match once mounted, with no hydration
 * mismatch and no setState-in-effect.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // Server has no matchMedia — treat as "not matching" so mobile-first markup wins.
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
