import { useEffect } from 'react';

/**
 * useVisualViewport
 *
 * Tracks the browser's Visual Viewport API to detect when the soft keyboard
 * opens or closes on iOS/Android. When detected, it:
 *   1. Sets `--visual-viewport-height` and `--keyboard-height` CSS variables on :root
 *   2. Toggles `body[data-keyboard="open"]` so CSS rules can respond declaratively
 *
 * Why visualViewport instead of window.resize?
 *   - `window.resize` fires when the browser chrome changes (URL bar show/hide).
 *   - `visualViewport.resize` fires specifically when the visible portion of the
 *     page changes, which is exactly what happens when the soft keyboard appears.
 *   - This is the correct modern API for "soft keyboard detection".
 *
 * Skill compliance:
 *   - adaptive-ui-strategy §4 Mobile (Touch)
 *   - runtime-stability-and-coding-health §3 Truthiness (null-guards on API)
 */
export const useVisualViewport = () => {
  useEffect(() => {
    // Guard: only run on mobile and only when the API is available.
    // The API exists in all modern mobile browsers (Safari ≥13, Chrome ≥61).
    const vv = window.visualViewport;
    if (!vv) return;

    // Cache the full window height at mount time.
    // We consider the keyboard "open" when the visual viewport is less than
    // 75% of the window height — a threshold that survives URL bar hide/show.
    const fullWindowHeight = window.innerHeight;
    const KEYBOARD_THRESHOLD = 0.75;

    const applyViewportVars = () => {
      const vvHeight = Math.round(vv.height);
      const keyboardHeight = Math.max(0, fullWindowHeight - vvHeight);
      const isKeyboardOpen = vvHeight < fullWindowHeight * KEYBOARD_THRESHOLD;

      // Write CSS custom properties so declarative CSS rules can respond.
      document.documentElement.style.setProperty('--visual-viewport-height', `${vvHeight}px`);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

      // Toggle a data attribute on <body> as a CSS hook.
      document.body.dataset.keyboard = isKeyboardOpen ? 'open' : 'closed';
    };

    // Run once on mount to initialize values.
    applyViewportVars();

    vv.addEventListener('resize', applyViewportVars);
    vv.addEventListener('scroll', applyViewportVars);

    return () => {
      vv.removeEventListener('resize', applyViewportVars);
      vv.removeEventListener('scroll', applyViewportVars);
      // Clean up CSS vars and body attribute on unmount.
      document.documentElement.style.removeProperty('--visual-viewport-height');
      document.documentElement.style.removeProperty('--keyboard-height');
      delete document.body.dataset.keyboard;
    };
  }, []); // No deps — runs once, imperative cleanup handles teardown.
};
