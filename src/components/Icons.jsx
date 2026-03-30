import React from 'react';

/**
 * Standardized SVG Icons for Task Actions
 * All icons follow a consistent SF-style weight (1.2pt / 1.5pt) 
 * and rely on currentColor for easy color-mixing/softening.
 */

const IconBase = ({ children, size = 16, strokeWidth = 1.6, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth={strokeWidth} 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={`standard-icon ${className}`}
    style={{ opacity: 0.6, verticalAlign: 'middle', transition: 'all 0.2s ease' }}
  >
    {children}
  </svg>
);

export const IconEdit = (props) => (
  <IconBase {...props}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </IconBase>
);

export const IconDelete = (props) => (
  <IconBase {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </IconBase>
);

export const IconUpload = (props) => (
  <IconBase {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </IconBase>
);

export const IconPlus = (props) => (
  <IconBase {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </IconBase>
);

export const IconArrowLeft = (props) => (
  <IconBase {...props}>
    <polyline points="15 18 9 12 15 6" />
  </IconBase>
);

export const IconArrowRight = (props) => (
  <IconBase {...props}>
    <polyline points="9 18 15 12 9 6" />
  </IconBase>
);

export const IconPromote = (props) => (
  <IconBase {...props}>
    <polyline points="18 15 12 9 6 15" />
  </IconBase>
);

export const IconDiagonalUp = (props) => (
  <IconBase {...props}>
    <polyline points="7 7 17 7 17 17" />
    <line x1="7" y1="17" x2="17" y2="7" />
  </IconBase>
);
