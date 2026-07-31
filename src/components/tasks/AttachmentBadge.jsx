import React, { useState, useEffect, useCallback } from 'react';
import './AttachmentBadge.css';

/**
 * AttachmentBadge
 *
 * Renders a small persistent 📷 camera badge on any task card/row when the
 * task's latest submission contains image attachments. Clicking the badge opens
 * a fullscreen lightbox slideshow of those images.
 *
 * Designed for use in TaskCard (Kanban) and ListViewRow (List view) — the two
 * modular root components — so vertical-specific files never need to be touched.
 *
 * Props:
 *   task (object): A normalized task object. Reads task.latestSubmission.links
 */
const AttachmentBadge = ({ task }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  // ── Derive image links from the latest submission ──────────────────────────
  const links = task?.latestSubmission?.links;
  const imageLinks = Array.isArray(links)
    ? links.filter(l => l?.mime_type?.startsWith('image/') && l?.url)
    : [];

  // No images → nothing to render
  if (imageLinks.length === 0) return null;

  // ── Lightbox navigation helpers ────────────────────────────────────────────
  const goNext = useCallback((e) => {
    if (e) e.stopPropagation();
    setSlideIndex(prev => (prev + 1) % imageLinks.length);
  }, [imageLinks.length]);

  const goPrev = useCallback((e) => {
    if (e) e.stopPropagation();
    setSlideIndex(prev => (prev - 1 + imageLinks.length) % imageLinks.length);
  }, [imageLinks.length]);

  const closeLightbox = useCallback((e) => {
    if (e) e.stopPropagation();
    setLightboxOpen(false);
    setSlideIndex(0);
  }, []);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') closeLightbox();
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, goNext, goPrev, closeLightbox]);

  // ── Open handler ───────────────────────────────────────────────────────────
  const handleBadgeClick = (e) => {
    e.stopPropagation(); // Prevent card expand / edit modal
    e.preventDefault();
    setSlideIndex(0);
    setLightboxOpen(true);
  };

  const currentImage = imageLinks[slideIndex];

  return (
    <>
      {/* ── Camera Badge ─────────────────────────────────────────────────── */}
      <button
        type="button"
        className="attachment-camera-badge"
        onClick={handleBadgeClick}
        title={`${imageLinks.length} photo${imageLinks.length > 1 ? 's' : ''} attached — click to view`}
        aria-label="View attached photos"
      >
        📷
        {imageLinks.length > 1 && (
          <span className="attachment-camera-count">{imageLinks.length}</span>
        )}
      </button>

      {/* ── Lightbox Overlay ─────────────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="attachment-lightbox-overlay"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          {/* Inner panel — stops click-through to overlay close */}
          <div
            className="attachment-lightbox-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              className="attachment-lightbox-close"
              onClick={closeLightbox}
              aria-label="Close viewer"
            >
              ✕
            </button>

            {/* Counter */}
            <div className="attachment-lightbox-counter">
              {slideIndex + 1} / {imageLinks.length}
            </div>

            {/* Image */}
            <img
              key={currentImage.url}
              className="attachment-lightbox-img"
              src={currentImage.url}
              alt={currentImage.file_name || `Photo ${slideIndex + 1}`}
            />

            {/* File name caption */}
            {currentImage.file_name && (
              <div className="attachment-lightbox-caption">
                {currentImage.file_name}
              </div>
            )}

            {/* Navigation — only rendered when multiple images exist */}
            {imageLinks.length > 1 && (
              <>
                <button
                  type="button"
                  className="attachment-lightbox-nav attachment-lightbox-nav--prev"
                  onClick={goPrev}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="attachment-lightbox-nav attachment-lightbox-nav--next"
                  onClick={goNext}
                  aria-label="Next photo"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AttachmentBadge;
