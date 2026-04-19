import { useState, useEffect, useRef } from 'react';

export const useScrollDirection = (threshold = 10, offset = 100) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = (e) => {
      const target = e.target;
      // Handle both specific element scrolling and window/document scrolling
      const currentScrollY = target.scrollTop !== undefined 
        ? target.scrollTop 
        : (window.pageYOffset || document.documentElement.scrollTop);
        
      const diff = currentScrollY - lastScrollY.current;

      if (Math.abs(diff) > threshold) {
        if (diff > 0 && isVisible && currentScrollY > offset) {
          // Scrolling down + past top offset
          setIsVisible(false);
        } else if (diff < 0 && !isVisible) {
          // Scrolling up
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
