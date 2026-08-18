"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * MediaQueryList objects are cached per query string.
 *
 * React calls getSnapshot on every render (and again to check for tearing), so
 * constructing a fresh MediaQueryList each time put real work on the hot path
 * of anything that re-renders per frame — the venue map's drag loop, for one.
 * matchMedia returns a live object, so one per query is all that's ever needed.
 */
const lists = new Map<string, MediaQueryList>();

function listFor(query: string): MediaQueryList {
  let mql = lists.get(query);
  if (!mql) {
    mql = window.matchMedia(query);
    lists.set(query, mql);
  }
  return mql;
}

/**
 * SSR-safe media-query subscription via useSyncExternalStore — the idiomatic
 * way to read an external browser store. Returns false on the server (and the
 * first client render), then the real match once mounted, with no hydration
 * mismatch and no setState-in-effect.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = listFor(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => listFor(query).matches, [query]);

  // Server has no matchMedia — treat as "not matching" so mobile-first markup wins.
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
