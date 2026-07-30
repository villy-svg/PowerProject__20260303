/**
 * CleaningQRGenerator.jsx
 *
 * Admin tool for generating QR codes that link to the Public Support Form.
 * Placed inside System Configuration → Data Manager → "Cleaning QR Generator".
 *
 * The generated URL encodes:
 *   hubId     — the selected hub's UUID
 *   managerId — the selected manager (employee) UUID
 *   summary   — a customizable label (e.g. "Cleaning Issue", "Washroom Maintenance")
 *
 * When scanned, the URL opens PublicSupportForm.jsx which reads these params
 * and pre-fills the form context and assigns the task to the correct manager.
 *
 * Guard: Only accessible to users with permissions.canAccessConfig === true.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '../../../services/core/supabaseClient';
import './CleaningQRGenerator.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the public report URL with the selected params encoded as query string.
 * Uses window.location.origin so the URL is always correct in any environment.
 */
function buildReportUrl(hubId, managerId, summary) {
  const base = `${window.location.origin}/public/report`;
  const params = new URLSearchParams();
  if (hubId) params.set('hubId', hubId);
  if (managerId) params.set('managerId', managerId);
  if (summary && summary.trim()) params.set('summary', summary.trim());
  return `${base}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CleaningQRGenerator = ({ permissions = {} }) => {
  // ── Data state ────────────────────────────────────────────────────────────
  const [hubs, setHubs] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loadingHubs, setLoadingHubs] = useState(false);
  const [loadingManagers, setLoadingManagers] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [selectedHubId, setSelectedHubId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  // Admin can customize the summary label that gets baked into the QR URL
  const [summaryLabel, setSummaryLabel] = useState('Cleaning Issue');

  const canvasRef = useRef(null);

  // ── RBAC guard ────────────────────────────────────────────────────────────
  // Only Master Admins and users with canAccessConfig can use this tool.
  if (!permissions.canAccessConfig) {
    return (
      <div className="cqr-wrapper">
        <div className="dm-alert dm-alert--error">
          <strong>Access Denied:</strong>
          <p>System Configuration access is required to use the QR Generator.</p>
        </div>
      </div>
    );
  }

  // ── Fetch hubs ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchHubs = async () => {
      setLoadingHubs(true);
      try {
        const { data, error } = await supabase
          .from('hubs')
          .select('id, name, hub_code, city')
          .eq('status', 'active')
          .order('name', { ascending: true });

        if (error) throw error;
        setHubs(data || []);
      } catch (err) {
        console.error('[CleaningQRGenerator] Failed to fetch hubs:', err);
      } finally {
        setLoadingHubs(false);
      }
    };
    fetchHubs();
  }, []);

  // ── Fetch managers (employees) filtered by selected hub ───────────────────
  // When a hub is selected, load all active employees at that hub so the admin
  // can assign a specific manager. Resets selection when hub changes.
  useEffect(() => {
    setSelectedManagerId('');
    setManagers([]);
    if (!selectedHubId) return;

    const fetchManagers = async () => {
      setLoadingManagers(true);
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, full_name, emp_code, role')
          .eq('hub_id', selectedHubId)
          .eq('status', 'Active')
          .order('full_name', { ascending: true });

        if (error) throw error;
        setManagers(data || []);
      } catch (err) {
        console.error('[CleaningQRGenerator] Failed to fetch managers:', err);
      } finally {
        setLoadingManagers(false);
      }
    };
    fetchManagers();
  }, [selectedHubId]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isReadyToGenerate = !!(selectedHubId && selectedManagerId);
  const reportUrl = isReadyToGenerate
    ? buildReportUrl(selectedHubId, selectedManagerId, summaryLabel)
    : null;

  // ── Download handler ───────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;

    // The QRCodeCanvas renders inside a wrapper div; find the <canvas> element
    const canvas = canvasRef.current.querySelector('canvas');
    if (!canvas) return;

    const selectedHub = hubs.find((h) => h.id === selectedHubId);
    const hubLabel = selectedHub?.hub_code ?? selectedHub?.name ?? 'hub';
    const safeLabel = summaryLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `qr_${hubLabel}_${safeLabel}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [hubs, selectedHubId, summaryLabel]);

  // ── Copy URL handler ───────────────────────────────────────────────────────
  const handleCopyUrl = useCallback(() => {
    if (!reportUrl) return;
    navigator.clipboard.writeText(reportUrl).catch((err) => {
      console.warn('[CleaningQRGenerator] Clipboard write failed:', err);
    });
  }, [reportUrl]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="cqr-wrapper">

      {/* Header */}
      <div className="cqr-header">
        <h2 className="cqr-title">Cleaning QR Generator</h2>
        <p className="cqr-subtitle">
          Generate a QR code that cleaning staff can scan to report facility issues directly
          to an assigned manager — no login required.
        </p>
      </div>

      {/* ── Configuration form card ───────────────────────────────────────── */}
      <div className="cqr-card">

        {/* Hub selector */}
        <div className="cqr-form-group">
          <label className="cqr-label" htmlFor="cqr-hub-select">
            Hub
          </label>
          <div className="cqr-input-container">
            {loadingHubs ? (
              <div className="cqr-loading">
                <span className="cqr-spinner" aria-hidden="true" />
                Loading hubs…
              </div>
            ) : (
              <select
                id="cqr-hub-select"
                className="cqr-input master-dropdown"
                value={selectedHubId}
                onChange={(e) => setSelectedHubId(e.target.value)}
              >
                <option value="">— Select a Hub —</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}{hub.hub_code ? ` (${hub.hub_code})` : ''}{hub.city ? ` — ${hub.city}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Manager selector — only shown after a hub is chosen */}
        {selectedHubId && (
          <div className="cqr-form-group">
            <label className="cqr-label" htmlFor="cqr-manager-select">
              Assign to Manager
            </label>
            <div className="cqr-input-container">
              {loadingManagers ? (
                <div className="cqr-loading">
                  <span className="cqr-spinner" aria-hidden="true" />
                  Loading staff…
                </div>
              ) : managers.length === 0 ? (
                <div className="cqr-loading">No active staff found at this hub.</div>
              ) : (
                <select
                  id="cqr-manager-select"
                  className="cqr-input master-dropdown"
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                >
                  <option value="">— Select a Manager —</option>
                  {managers.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}{emp.emp_code ? ` · ${emp.emp_code}` : ''}{emp.role ? ` — ${emp.role}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Custom summary label — lets admin set the issue category */}
        <div className="cqr-form-group">
          <label className="cqr-label" htmlFor="cqr-summary-input">
            Issue Category Label{' '}
            <span style={{ opacity: 0.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              (baked into the QR URL)
            </span>
          </label>
          <div className="cqr-input-container">
            <input
              id="cqr-summary-input"
              type="text"
              className="cqr-input"
              value={summaryLabel}
              onChange={(e) => setSummaryLabel(e.target.value)}
              placeholder="e.g. Cleaning Issue, Washroom Maintenance, Garbage Overflow"
              maxLength={80}
            />
          </div>
        </div>

      </div>

      {/* ── QR Preview card ───────────────────────────────────────────────── */}
      <div className="cqr-preview-card">
        <p className="cqr-preview-title">QR Code Preview</p>

        {isReadyToGenerate ? (
          <>
            {/* QRCodeCanvas ref wrapper — used by handleDownload to find the <canvas> */}
            <div className="cqr-canvas-wrap" ref={canvasRef}>
              <QRCodeCanvas
                value={reportUrl}
                size={200}
                bgColor="#ffffff"
                fgColor="#050505"
                level="H"
                includeMargin={false}
              />
            </div>

            {/* URL preview */}
            <div className="cqr-url-preview">
              {/* Link icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, color: 'var(--brand-mint)', opacity: 0.6 }}>
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              <span className="cqr-url-text">{reportUrl}</span>
            </div>

            {/* Action buttons */}
            <div className="cqr-actions">
              <button
                type="button"
                className="halo-button"
                id="cqr-download-btn"
                onClick={handleDownload}
              >
                {/* Download icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download QR
              </button>

              <button
                type="button"
                className="halo-button"
                id="cqr-copy-url-btn"
                onClick={handleCopyUrl}
              >
                {/* Copy icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy URL
              </button>
            </div>
          </>
        ) : (
          <div className="cqr-placeholder">
            {/* QR icon */}
            <svg className="cqr-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" />
              <rect x="19" y="14" width="2" height="2" />
              <rect x="14" y="19" width="2" height="2" />
              <rect x="18" y="18" width="3" height="3" />
            </svg>
            <p className="cqr-placeholder-text">
              Select a hub and manager to generate the QR code
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default CleaningQRGenerator;
