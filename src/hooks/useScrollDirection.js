import { useState, useEffect, useRef } from 'react';

/**
 * useScrollDirection
 * Returns `true` when the tray should be visible (scrolling up, or at rest),
 * and `false` when the tray should hide (scrolling down past `offset`).
 *
 * Bounce Guard: Ignores direction changes caused by elastic overscroll — both
 * at the top (negative scrollY) and at the bottom (beyond scrollable boundary).
 *
 * @param {number} threshold - Minimum scroll delta (px) to trigger a state change.
 * @param {number} offset    - Minimum distance from top before hide is allowed.
 */
export const useScrollDirection = (threshold = 10, offset = 100) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = (e) => {
      const target = e.target;
      const currentScrollY = target.scrollTop !== undefined
        ? target.scrollTop
        : (window.pageYOffset || document.documentElement.scrollTop);

      // --- Bounce Guard ---
      // Detect bounce at the top: scrollY has gone negative (iOS rubber-band).
      if (currentScrollY < 0) {
        lastScrollY.current = 0;
        return;
      }
      // Detect bounce at the bottom: scrollY exceeds the real scrollable area.
      const scrollableEl = target.scrollTop !== undefined ? target : document.documentElement;
      const maxScroll = scrollableEl.scrollHeight - scrollableEl.clientHeight;
      if (maxScroll > 0 && currentScrollY > maxScroll) {
        lastScrollY.current = maxScroll;
        return;
      }
      // --- End Bounce Guard ---

      const diff = currentScrollY - lastScrollY.current;

      if (Math.abs(diff) > threshold) {
        if (diff > 0 && isVisible && currentScrollY > offset) {
          // Scrolling down past the offset — hide the tray.
          setIsVisible(false);
        } else if (diff < 0 && !isVisible) {
          // Scrolling up — show the tray.
          setIsVisible(true);
        }
        lastScrollY.current = currentScrollY;
      }
    };

    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [isVisible, threshold, offset]);

  return isVisible;
};
