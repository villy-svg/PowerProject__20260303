import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import './MobileLongPress.css';

const MobileLongPressContext = createContext(null);

export const useMobileLongPress = () => {
  const context = useContext(MobileLongPressContext);
  if (!context) {
    throw new Error('useMobileLongPress must be used within a MobileLongPressProvider');
  }
  return context;
};

export const MobileLongPressProvider = ({ children }) => {
  const { isMobile } = useIsMobile();
  const [tooltipState, setTooltipState] = useState({
    isOpen: false,
    text: '',
    rect: null,
  });

  const lastTapMap = useRef(new WeakMap());
  const lastTouchTime = useRef(0);

  // Close tooltip on any click/tap anywhere
  useEffect(() => {
    const handleGlobalTap = () => {
      if (tooltipState.isOpen) {
        setTooltipState(prev => ({ ...prev, isOpen: false }));
      }
    };

    if (tooltipState.isOpen) {
      // Small timeout to prevent the current touch/tap event from immediately closing it
      const timer = setTimeout(() => {
        window.addEventListener('click', handleGlobalTap);
        window.addEventListener('touchstart', handleGlobalTap);
      }, 80);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('click', handleGlobalTap);
        window.removeEventListener('touchstart', handleGlobalTap);
      };
    }
  }, [tooltipState.isOpen]);

  const bindLongPress = (text) => {
    // Only enable on mobile
    if (!isMobile) return {};

    const handleTap = (e) => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 300; // 300ms threshold for double tap
      const element = e.currentTarget;

      // Prevent dual-firing of touchstart + mousedown emulation on mobile browsers
      if (e.type === 'mousedown') {
        if (now - lastTouchTime.current < 800) {
          return;
        }
      } else if (e.type === 'touchstart') {
        lastTouchTime.current = now;
      }

      const lastTapTime = lastTapMap.current.get(element) || 0;

      if (now - lastTapTime < DOUBLE_PRESS_DELAY) {
        const rect = element.getBoundingClientRect();
        // Vibrate if supported for haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(15);
        }
        setTooltipState({
          isOpen: true,
          text,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom,
            right: rect.right
          }
        });
        // Reset to prevent successive triple taps from double triggering
        lastTapMap.current.set(element, 0);
      } else {
        lastTapMap.current.set(element, now);
      }
    };

    return {
      onTouchStart: handleTap,
      onMouseDown: handleTap,
    };
  };

  // Calculate position
  let tooltipStyle = {};
  let placementClass = 'tooltip-above';

  if (tooltipState.isOpen && tooltipState.rect) {
    const { top, left, width, height, bottom } = tooltipState.rect;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default target: above the button
    let tooltipY = top - 10; 
    let tooltipX = left + width / 2;

    if (top < 100) {
      // Flow downwards if too close to top
      tooltipY = bottom + 10;
      placementClass = 'tooltip-below';
    }

    // Keep within horizontal screen bounds
    const padding = 16;
    const estimatedHalfWidth = 130; // Max-width is 260px
    if (tooltipX - estimatedHalfWidth < padding) {
      tooltipX = estimatedHalfWidth + padding;
    } else if (tooltipX + estimatedHalfWidth > viewportWidth - padding) {
      tooltipX = viewportWidth - estimatedHalfWidth - padding;
    }

    tooltipStyle = {
      position: 'fixed',
      top: `${tooltipY}px`,
      left: `${tooltipX}px`,
      transform: placementClass === 'tooltip-above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      zIndex: 9999,
    };
  }

  return (
    <MobileLongPressContext.Provider value={{ bindLongPress }}>
      {children}
      {tooltipState.isOpen && (
        <>
          {/* Subtle backdrop overlay for immersive feel */}
          <div className="mobile-longpress-backdrop animate-fade-in" />
          <div 
            className={`mobile-longpress-bubble ${placementClass}`}
            style={tooltipStyle}
          >
            <div className="tooltip-content">
              {tooltipState.text}
            </div>
            <div className="tooltip-arrow" />
          </div>
        </>
      )}
    </MobileLongPressContext.Provider>
  );
};
