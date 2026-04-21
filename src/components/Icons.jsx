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

export const IconTrash = (props) => (
  <IconBase {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </IconBase>
);

export const IconX = (props) => (
  <IconBase {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </IconBase>
);

export const IconChevronDown = (props) => (
  <IconBase {...props}>
    <polyline points="6 9 12 15 18 9" />
  </IconBase>
);

export const IconChevronRight = (props) => (
  <IconBase {...props}>
    <polyline points="7 18 13 12 7 6" />
    <polyline points="13 18 19 12 13 6" />
  </IconBase>
);

export const IconChevronLeft = (props) => (
  <IconBase {...props}>
    <polyline points="17 18 11 12 17 6" />
    <polyline points="11 18 5 12 11 6" />
  </IconBase>
);

export const IconHome = (props) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </IconBase>
);

export const IconMenu = (props) => (
  <IconBase {...props}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </IconBase>
);

export const IconSidebar = (props) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </IconBase>
);

export const IconHubs = (props) => (
  <IconBase {...props}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </IconBase>
);

export const IconPeople = (props) => (
  <IconBase {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </IconBase>
);

export const IconDatabase = (props) => (
  <IconBase {...props}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </IconBase>
);

export const IconCheck = (props) => (
  <IconBase {...props}>
    <polyline points="20 6 9 17 4 12" />
  </IconBase>
);

export const IconFile = (props) => (
  <IconBase {...props}>
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </IconBase>
);
