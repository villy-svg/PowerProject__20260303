/**
 * PublicSupportForm.jsx
 *
 * Standalone, publicly accessible support form — designed to be reached via
 * a QR code scan without requiring an authenticated session.
 *
 * Flow:
 *  1. On mount, call supabase.auth.signInAnonymously() to obtain an anon JWT
 *     (needed so the Edge Function can verify we're calling from a valid client)
 *  2. Read hubId, managerId, summary from URL query params
 *  3. Let the user write a description and optionally attach a photo
 *  4. Execute invisible hCaptcha on submit
 *  5. Call the 'public-support-request' Edge Function
 *
 * CAPTCHA: Uses hCaptcha invisible widget (https://www.hcaptcha.com).
 *   Set VITE_HCAPTCHA_SITE_KEY in your .env file.
 *
 * This component does NOT use any app-level context (useAuth, useTheme, etc.)
 * because it renders before any session is established. It calls Supabase
 * directly via the supabaseClient service singleton.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import './PublicSupportForm.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compresses an image File to JPEG at reduced quality if it is large.
 * Returns a base64 string and MIME type.
 */
async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale down if wider than 1600px
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        // Strip the "data:image/jpeg;base64," prefix
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Executes the hCaptcha invisible challenge programmatically and returns a token.
 * The widget container div must be rendered in the DOM before calling this.
 * Falls back to an empty string if the hcaptcha global is not loaded.
 */
async function executeCaptcha(widgetId) {
  if (typeof window.hcaptcha === 'undefined') {
    console.warn('[PublicSupportForm] hcaptcha not loaded — proceeding without token.');
    return '';
  }
  try {
    // hcaptcha.execute() returns a Promise<{ response: string }> for invisible widgets
    const result = await window.hcaptcha.execute(widgetId, { async: true });
    return result.response;
  } catch (err) {
    console.error('[PublicSupportForm] hcaptcha.execute failed:', err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const PublicSupportForm = () => {
  // ── URL params ─────────────────────────────────────────────────────────────
  const [params, setParams] = useState({ hubId: null, managerId: null, summary: '' });

  // ── Form state ─────────────────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Lifecycle state ────────────────────────────────────────────────────────
  // Note: anonymous sign-in is intentionally omitted. The Edge Function uses
  // SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) and validates requests via hCaptcha.
  // Supabase Auth's captcha-protection setting would block bare signInAnonymously()
  // calls, and a caller JWT is not required by the function.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  // ── hCaptcha site key (set VITE_HCAPTCHA_SITE_KEY in .env) ─────────────────
  const captchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY ?? '';

  // hCaptcha widget ID ref — returned by hcaptcha.render() and used for execute()
  const hcaptchaWidgetId = useRef(null);

  // ── Parse URL params on mount ──────────────────────────────────────────────
  useEffect(() => {
    // Because the route is /#/support?hubId=..., window.location.search is empty.
    // We must extract the query string from the hash.
    const hashSplit = window.location.hash.split('?');
    const queryString = hashSplit.length > 1 ? hashSplit[1] : '';
    const searchParams = new URLSearchParams(queryString);
    
    setParams({
      hubId: searchParams.get('hubId'),
      managerId: searchParams.get('managerId'),
      summary: searchParams.get('summary') || '',
    });
  }, []);

  // Anonymous sign-in removed — not needed. See comment on lifecycle state above.

  // ── Inject hCaptcha script and render invisible widget ─────────────────────
  // hCaptcha invisible: the widget is rendered into a hidden div, then executed
  // programmatically on submit via hcaptcha.execute(widgetId, { async: true }).
  useEffect(() => {
    if (!captchaSiteKey) return;
    if (document.getElementById('hcaptcha-script')) return;

    const script = document.createElement('script');
    script.id = 'hcaptcha-script';
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=_hcaptchaOnLoad';
    script.async = true;
    script.defer = true;

    // onload callback — renders the invisible widget into the hidden container
    window._hcaptchaOnLoad = () => {
      const container = document.getElementById('hcaptcha-container');
      if (!container || hcaptchaWidgetId.current !== null) return;
      hcaptchaWidgetId.current = window.hcaptcha.render(container, {
        sitekey: captchaSiteKey,
        size: 'invisible',
        // Callback not needed — we use the async execute() API instead
      });
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: remove global onload hook if component unmounts before script loads
      delete window._hcaptchaOnLoad;
    };
  }, [captchaSiteKey]);

  // ── Image selection & compression ─────────────────────────────────────────
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, WebP, or HEIC image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Image must be smaller than 25 MB.');
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagePreviewUrl]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!params.managerId) {
      setError('This link is missing required information (managerId). Please use the QR code provided at your location.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Please provide a description of at least 10 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Obtain hCaptcha token — executes the invisible widget programmatically
      const captchaToken = captchaSiteKey
        ? await executeCaptcha(hcaptchaWidgetId.current)
        : 'dev-bypass';

      // 2. Process image if provided
      let imageBase64 = null;
      let imageMimeType = null;
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        imageBase64 = compressed.base64;
        imageMimeType = compressed.mimeType;
      }

      // 3. Call the Edge Function
      const { data, error: fnError } = await supabase.functions.invoke(
        'public-support-request',
        {
          body: {
            captchaToken,
            hubId: params.hubId,
            managerId: params.managerId,
            summary: params.summary
              ? `${params.summary}: ${description.trim()}`
              : description.trim(),
            imageBase64,
            imageMimeType,
          },
        }
      );

      if (fnError || !data?.success) {
        const msg = data?.error ?? fnError?.message ?? 'Submission failed. Please try again.';
        setError(msg);
        return;
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err?.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render: init error ─────────────────────────────────────────────────────
  if (initError) {
    return (
      <div className="psf-page">
        <div className="psf-card">
          <div className="psf-alert psf-alert--error">
            <span>{initError}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: success state ──────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div className="psf-page">
        <div className="psf-card">
          <div className="psf-success-card">
            {/* Checkmark icon (inline SVG — no lucide-react import needed here) */}
            <svg className="psf-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <h2 className="psf-success-title">Report Submitted</h2>
            <p className="psf-success-body">
              Your support request has been received and assigned to the responsible manager.
              Thank you for helping keep the facility clean.
            </p>
          </div>
          <div className="psf-footer">Powered by PowerProject</div>
        </div>
      </div>
    );
  }

  // ── Render: form ───────────────────────────────────────────────────────────
  return (
    <div className="psf-page">
      <div className="psf-card">

        {/* Header */}
        <div className="psf-header">
          <div className="psf-brand-mark">
            {/* Lightning bolt icon — inline SVG */}
            <svg className="psf-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="psf-brand-label">PowerProject</span>
          </div>
          <h1 className="psf-title">Submit a Support Request</h1>
          <p className="psf-subtitle">
            Use this form to report a cleaning issue or facility concern. Your report
            will be sent directly to the assigned manager.
          </p>
        </div>

        {/* Context badges — show pre-filled info from URL */}
        {(params.hubId || params.summary) && (
          <div className="psf-context-row">
            {params.summary && (
              <span className="psf-badge">
                {/* Tag icon */}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                {decodeURIComponent(params.summary)}
              </span>
            )}
            {params.hubId && (
              <span className="psf-badge">
                {/* Map pin icon */}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Hub: {params.hubId.slice(0, 8)}…
              </span>
            )}
          </div>
        )}

        {/* Form */}
        <form className="psf-body" onSubmit={handleSubmit} noValidate>

          {/* Description field */}
          <div className="psf-form-group">
            <label className="psf-label" htmlFor="psf-description">
              Describe the Issue
            </label>
            <div className="psf-input-container">
              <textarea
                id="psf-description"
                className="psf-textarea"
                placeholder="e.g. The charging bay floor has not been cleaned since morning…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={!isReady || isSubmitting}
                required
              />
            </div>
          </div>

          {/* Photo upload */}
          <div className="psf-form-group">
            <label className="psf-label">
              Attach a Photo <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
            </label>

            {imagePreviewUrl ? (
              <div className="psf-preview">
                <img
                  className="psf-preview-img"
                  src={imagePreviewUrl}
                  alt="Selected photo preview"
                />
                <button
                  type="button"
                  className="psf-preview-remove"
                  onClick={handleRemoveImage}
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                className={`psf-dropzone${isDragOver ? ' psf-dropzone--active' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                aria-label="Upload photo"
              >
                {/* Upload icon */}
                <svg className="psf-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="psf-dropzone-text">Tap to attach a photo, or drag &amp; drop</p>
                <p className="psf-dropzone-hint">JPEG, PNG, WebP, HEIC — max 25 MB</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="psf-file-input"
              onChange={handleFileInputChange}
              aria-label="File upload input"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="psf-alert psf-alert--error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="psf-submit-btn"
            id="psf-submit"
            disabled={!isReady || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="psf-spinner" aria-hidden="true" />
                Submitting…
              </>
            ) : (
              <>
                {/* Send icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Submit Report
              </>
            )}
          </button>
        </form>

        {/* Hidden hCaptcha invisible widget container — rendered here so it's always
            in the DOM when execute() is called. Visibility is managed by the widget itself. */}
        {captchaSiteKey && (
          <div id="hcaptcha-container" aria-hidden="true" />
        )}

        <div className="psf-footer">Powered by PowerProject — All reports are reviewed by facility management</div>
      </div>
    </div>
  );
};

export default PublicSupportForm;
