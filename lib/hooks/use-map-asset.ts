"use client";

import { useEffect, useState } from "react";
import { fetchObjectUrl } from "@/lib/api/client";

export interface MapAssetState {
  /** Object URL once loaded; null while loading or after a failure. */
  url: string | null;
  /** True once the fetch has definitively failed. */
  failed: boolean;
}

interface Entry {
  promise: Promise<string>;
  url?: string;
  refs: number;
}

/**
 * Process-wide cache of loaded map artwork, keyed by source URL.
 *
 * The guest flow shows the SAME venue map on the area step and the spot step —
 * that continuity is the entire point of the redesign. Without a shared cache
 * each step mounts its own loader, re-downloads the artwork, and the map
 * visibly blinks at the exact moment it is supposed to be smoothly zooming.
 *
 * Refcounted rather than unbounded: a venue has one map, but an editor session
 * that replaces it should not leak the old blob.
 */
const cache = new Map<string, Entry>();

function acquire(key: string): Entry {
  const existing = cache.get(key);
  if (existing) {
    existing.refs += 1;
    return existing;
  }

  const entry: Entry = {
    refs: 1,
    promise: fetchObjectUrl(key).then((url) => {
      // Only keep the blob alive if someone is still waiting on it.
      const live = cache.get(key);
      if (live) live.url = url;
      else URL.revokeObjectURL(url);
      return url;
    }),
  };

  cache.set(key, entry);
  return entry;
}

function release(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;

  entry.refs -= 1;
  if (entry.refs > 0) return;

  cache.delete(key);
  if (entry.url) URL.revokeObjectURL(entry.url);
  // A still-pending fetch resolves into a cache with no entry, and the .then
  // above revokes it there.
  entry.promise.catch(() => {});
}

/**
 * Load a venue-map image (SVG or PNG) as an object URL.
 *
 * A bare `<img src>` can't send the Bearer token the staff asset route needs,
 * nor the ngrok skip header a tunnelled dev backend needs — so the bytes come
 * through the API client and are handed back as a blob: URL.
 *
 * `failed` exists because swallowing the error made a broken fetch look exactly
 * like a section with no artwork uploaded, which sent debugging in entirely the
 * wrong direction.
 */
export function useMapAssetUrl(pathOrUrl: string | null | undefined): MapAssetState {
  // Keyed by source so a changed asset never shows the previous one's blob
  // while the new fetch is in flight — and so clearing the source needs no
  // setState inside an effect.
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!pathOrUrl) return;

    let cancelled = false;
    const entry = acquire(pathOrUrl);

    entry.promise
      .then((url) => {
        if (!cancelled) setLoaded({ key: pathOrUrl, url });
      })
      .catch((err) => {
        if (cancelled) return;
        // Guest-facing copy stays friendly; whoever is debugging gets the real
        // reason in the console.
        console.error(`[venue-map] could not load ${pathOrUrl}`, err);
        setFailedKey(pathOrUrl);
      });

    return () => {
      cancelled = true;
      release(pathOrUrl);
    };
  }, [pathOrUrl]);

  if (!pathOrUrl) return { url: null, failed: false };

  return {
    url: loaded?.key === pathOrUrl ? loaded.url : null,
    failed: failedKey === pathOrUrl,
  };
}
