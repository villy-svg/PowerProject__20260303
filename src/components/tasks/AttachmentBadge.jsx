import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconCamera } from '../ui/Icons';
import './AttachmentBadge.css';

/**
 * AttachmentBadge
 *
 * Renders a small persistent 📷 camera badge on any task card/row when the
 * task has any submission containing image attachments. Clicking the badge
 * opens a fullscreen lightbox slideshow of ALL images across ALL submissions.
 *
 * Previously this read only task.latestSubmission.links, which caused a bug:
 * once a manager submitted Proof of Work (submission #2), the original public
 * report photo (submission #1) became permanently invisible from the task card.
 *
 * Fix: reads task.submissions (the full array from TASK_SELECT) and aggregates
 * all image links across every submission, ordered newest-submission-first.
 *
 * Designed for use in TaskCard (Kanban) and ListViewRow (List view) — the two
 * modular root components — so vertical-specific files never need to be touched.
 *
 * Props:
 *   task (object): A normalized task object.
 *                  Reads task.submissions[] — each item has a .links array.
 *                  Falls back to task.latestSubmission.links for legacy compat.
 */
const AttachmentBadge = ({ task }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  // ── Aggregate image links from ALL submissions ─────────────────────────────
  // Primary source: full submissions array (TASK_SELECT includes links + comment)
  // Fallback: latestSubmission.links (legacy path for any cached/older data)
  const allSubmissions = Array.isArray(task?.submissions) ? task.submissions : [];

  let imageLinks = [];

  if (allSubmissions.length > 0) {
    // Sort submissions newest-first (highest submission_number first) so the
    // lightbox slideshow opens with the most recent photos at index 0.
    const sorted = [...allSubmissions].sort(
      (a, b) => (b.submission_number || 0) - (a.submission_number || 0)
    );
    imageLinks = sorted.flatMap((s) =>
      Array.isArray(s.links)
        ? s.links.filter((l) => l?.mime_type?.startsWith('image/') && l?.url)
        : []
    );
  } else if (task?.latestSubmission?.links) {
    // Fallback for legacy normalised task objects that don't carry full submissions[]
    const fallbackLinks = task.latestSubmission.links;
    imageLinks = Array.isArray(fallbackLinks)
      ? fallbackLinks.filter((l) => l?.mime_type?.startsWith('image/') && l?.url)
      : [];
  }

  // Even if there are no images, we will render a disabled badge.

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
        className={`attachment-camera-badge ${imageLinks.length === 0 ? 'disabled' : ''}`}
        onClick={imageLinks.length > 0 ? handleBadgeClick : undefined}
        title={imageLinks.length > 0 ? `${imageLinks.length} photo${imageLinks.length > 1 ? 's' : ''} attached — click to view` : 'No photos attached'}
        aria-label={imageLinks.length > 0 ? "View attached photos" : "No attached photos"}
        disabled={imageLinks.length === 0}
      >
        <IconCamera size={15} />
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
