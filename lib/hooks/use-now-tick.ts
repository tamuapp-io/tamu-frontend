"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * A clock that re-renders on an interval.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect` because the
 * server has no meaningful "now": the server snapshot is `null`, so SSR and the
 * first client render agree, and the real time arrives on the next tick. A
 * `useState(() => new Date())` initialiser would render server time into the
 * markup and hydrate with client time — a guaranteed mismatch on any element
 * positioned from the clock.
 *
 * Returns `null` until mounted; callers should treat that as "no now line yet".
 */
export function useNowTick(intervalMs = 30_000): Date | null {
  // getSnapshot must be referentially stable between real ticks — returning a
  // fresh Date on every call makes React loop forever. Bucketing to the
  // interval gives a value that only changes when the tick actually fires.
  const cache = useRef<{ bucket: number; date: Date } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(onChange, intervalMs);
      // Background tabs throttle timers to roughly once a minute, so a tab left
      // open through a shift comes back stale. Re-read the moment it's visible.
      const onVisible = () => {
        if (document.visibilityState === "visible") onChange();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        window.clearInterval(id);
        document.removeEventListener("visibilitychange", onVisible);
      };
    },
    [intervalMs],
  );

  const getSnapshot = useCallback(() => {
    const bucket = Math.floor(Date.now() / intervalMs) * intervalMs;
    if (cache.current?.bucket !== bucket) {
      cache.current = { bucket, date: new Date(bucket) };
    }
    return cache.current.date;
  }, [intervalMs]);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
