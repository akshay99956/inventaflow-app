import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const scrollPositions = new Map<string, number>();

/**
 * Preserves scroll position per route path.
 * When navigating away, saves the current scroll.
 * When returning, restores it.
 */
export function useScrollPreservation() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    const newPath = location.pathname;

    // Save scroll of previous route
    if (prevPath !== newPath) {
      scrollPositions.set(prevPath, window.scrollY);
    }

    // Restore scroll of new route (use rAF to wait for render)
    const savedScroll = scrollPositions.get(newPath);
    if (savedScroll !== undefined) {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScroll);
      });
    } else {
      window.scrollTo(0, 0);
    }

    prevPathRef.current = newPath;
  }, [location.pathname]);
}
