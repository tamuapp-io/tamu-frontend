"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

/**
 * Keeps a horizontally scrolling timeline parked on the current time.
 *
 * Follow mode starts on and disengages the instant the operator scrolls by
 * hand — a timeline that yanks itself back to now while someone is reading the
 * 21:00 covers is worse than one that never moves at all. `jumpToNow()` puts it
 * back.
 *
 * @param nowOffset px from the start of the hour grid, or null when the current
 *   time falls outside the window the timeline draws.
 * @param labelWidth px of the frozen row-label column, which sits inside the
 *   same scroller and so offsets every hour position.
 */
export function useTimelineFollow(nowOffset: number | null, labelWidth: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Suppresses the follow effect's instant re-park while an explicit smooth
  // scroll is still animating, so the two don't fight over scrollLeft.
  const animatingUntil = useRef(0);

  const scrollToNow = useCallback(
    (smooth: boolean) => {
      const el = scrollRef.current;
      if (!el || nowOffset === null) return;
      // A third in from the left: on service, what's coming matters more than
      // what has already been seated.
      const left = labelWidth + nowOffset - el.clientWidth / 3;
      el.scrollTo({
        left: Math.max(0, left),
        behavior: smooth && !reduceMotion ? "smooth" : "auto",
      });
    },
    [nowOffset, labelWidth, reduceMotion],
  );

  // Re-parks on every clock tick while following. Deliberately not smooth: a
  // tick moves the line well under a pixel, and animating that burns frames for
  // nothing.
  useEffect(() => {
    if (!following || Date.now() < animatingUntil.current) return;
    scrollToNow(false);
  }, [following, scrollToNow]);

  const jumpToNow = useCallback(() => {
    animatingUntil.current = Date.now() + 600;
    setFollowing(true);
    scrollToNow(true);
  }, [scrollToNow]);

  // Intent events, not `onScroll`: our own scrollTo fires `scroll` too, and
  // telling the two apart after the fact is a race. A wheel, a drag, or an
  // arrow key is unambiguously the operator.
  const release = useCallback(() => setFollowing(false), []);

  const scrollHandlers = {
    onWheel: release,
    onPointerDown: release,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (
        e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown"
      ) {
        release();
      }
    },
  };

  return { scrollRef, following, jumpToNow, canFollow: nowOffset !== null, scrollHandlers };
}
