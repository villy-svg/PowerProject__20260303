// @prod-critical
import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { resolveTooltipContent } from '../../constants/rbacCatalog';
import './RoleTooltip.css';

/**
 * RoleTooltip
 *
 * Portal-based hover tooltip for RBAC role-level buttons, Scope cards,
 * Capability Level cards, and Master Role options.
 * Renders into document.body via createPortal (escapes all overflow clipping).
 * Uses position:fixed with viewport-relative coordinates from getBoundingClientRect().
 *
 * All capability copy & label normalization live in `src/constants/rbacCatalog.js`
 * (Single Source of Truth — see `.agent/rules/rbac-and-security.md §6`).
 *
 * Includes viewport edge detection:
 * - Flips below the anchor when too close to the top.
 * - Shifts left/right if too close to the edge of the screen, while keeping the caret pointing at the anchor.
 */

const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT_ESTIMATE = 260; // px — used for viewport edge detection

const RoleTooltip = ({
  level,
  contextName,
  isFeature,
  tooltipType = 'role',
  fullWidth = false,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords]       = useState({ top: 0, left: 0, flipBelow: false, caretOffset: 0 });
  const anchorRef = useRef(null);

  const {
    badge,
    headline,
    color,
    canonicalContextName,
    can,
    cannot,
    summary,
  } = resolveTooltipContent({ tooltipType, level, contextName });

  const show = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const spaceAbove = rect.top;
      const flipBelow = spaceAbove < TOOLTIP_HEIGHT_ESTIMATE + 12;

      let finalLeft = centreX;
      let caretOffset = 0;

      // Prevent tooltip from overflowing the right edge of the viewport
      if (finalLeft + (TOOLTIP_WIDTH / 2) > window.innerWidth - 10) {
        finalLeft = window.innerWidth - (TOOLTIP_WIDTH / 2) - 10;
        caretOffset = centreX - finalLeft; // Shift caret right to keep pointing at the anchor
      }
      // Prevent tooltip from overflowing the left edge
      if (finalLeft - (TOOLTIP_WIDTH / 2) < 10) {
        finalLeft = (TOOLTIP_WIDTH / 2) + 10;
        caretOffset = centreX - finalLeft; // Shift caret left
      }

      setCoords({
        top: flipBelow ? rect.bottom + 10 : rect.top,
        left: finalLeft,
        flipBelow,
        caretOffset,
      });
    }
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => setIsVisible(false), []);

  return (
    <div
      ref={anchorRef}
      className={`role-tooltip-anchor${fullWidth ? ' role-tooltip-anchor--block' : ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {isVisible && createPortal(
        <div
          className={`role-tooltip${coords.flipBelow ? ' role-tooltip--below' : ''}`}
          role="tooltip"
          style={{
            '--tooltip-accent': color,
            '--caret-offset': `${coords.caretOffset}px`,
            top: coords.top,
            left: coords.left,
          }}
        >
          {/* Header */}
          <div className="role-tooltip-header">
            <span className="role-tooltip-badge">{badge}</span>
            <span className="role-tooltip-headline">{headline}</span>
          </div>

          {/* Context line (vertical/feature buttons only) */}
          {tooltipType === 'role' && (canonicalContextName || contextName) && (
            <p className="role-tooltip-context">
              For <strong>{canonicalContextName || contextName}</strong> {isFeature ? 'feature' : 'vertical'}
            </p>
          )}

          {/* Permissions */}
          <div className="role-tooltip-perms">
            {can.length > 0 && (
              <ul className="role-tooltip-list role-tooltip-list--can">
                {can.map((item, i) => (
                  <li key={i}>
                    <span className="perm-icon perm-icon--yes">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {cannot.length > 0 && (
              <ul className="role-tooltip-list role-tooltip-list--cannot">
                {cannot.map((item, i) => (
                  <li key={i}>
                    <span className="perm-icon perm-icon--no">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Summary */}
          {summary && <p className="role-tooltip-summary">{summary}</p>}

          {/* Caret */}
          <div className="role-tooltip-caret" />
        </div>,
        document.body
      )}
    </div>
  );
};

export default RoleTooltip;
