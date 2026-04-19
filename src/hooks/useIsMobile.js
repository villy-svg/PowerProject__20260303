/**
 * useIsMobile Hook
 * 
 * Provides reactive viewport size detection for conditional rendering.
 * Uses a debounced resize listener for performance.
 * 
 * Breakpoints match the UI Design System §14:
 * - isPhone: ≤480px
 * - isTablet: ≤768px (includes phones)
 * - isMobile: ≤768px (alias for isTablet)
 * - isDesktop: >768px
 * 
 * Skill compliance:
 * - Dev Best Practices: Isolated hook, not scattered in components
 * - Runtime Stability: SSR-safe with window check
 */

import { useState, useEffect } from 'react';

const BREAKPOINTS = {
  phone: 480,
  tablet: 768,
};

export function useIsMobile() {
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  }));

  useEffect(() => {
    let timeoutId = null;

    const handleResize = () => {
      // Debounce resize events (100ms)
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDimensions({ width: window.innerWidth });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const isPhone = dimensions.width <= BREAKPOINTS.phone;
  const isTablet = dimensions.width <= BREAKPOINTS.tablet;
  const isMobile = isTablet; // Convenience alias
  const isDesktop = !isTablet;

  return {
    isPhone,
    isTablet,
    isMobile,
    isDesktop,
    viewportWidth: dimensions.width,
  };
}
