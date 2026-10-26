import React, { useState, useEffect, useCallback } from 'react';
import './EmployeeForm.css';
import { getEmployeeSubmissions, submitProofOfWork, updateSubmissionLinks, deleteSubmission } from '../../services/tasks/submissionService';
import { IconX } from '../../components/ui/Icons';

/**
 * EmployeeDocumentSection
 *
 * Union component for the document tabs of the Employee form:
 *   - "Documents"        -> documentType="general"      (any file type)
 *   - "Declaration Form" -> documentType="declaration"  (PDF / JPEG / PNG, multi-file)
 * Owns its own list/upload/delete state so both tabs share ONE implementation.
 * Extracted from EmployeeForm.jsx page 4 (behaviour and markup preserved for 'general').
 *
 * @param {Object}   props
 * @param {string}   props.employeeId       - Saved employee id (required to upload)
 * @param {string}   [props.documentType]   - 'general' | 'declaration'
 * @param {string}   [props.title]          - Section heading
 * @param {string}   [props.accept]         - Comma-separated MIME list for the picker (and validation)
 * @param {string}   [props.uploadText]     - Dropzone primary text
 * @param {string}   [props.uploadSubtext]  - Dropzone secondary text
 * @param {string}   [props.emptyText]      - Text shown when no files exist
 * @param {boolean}  [props.showStatus]     - Show "uploaded / not uploaded" banner
 * @param {boolean}  [props.canUpload]      - Render the dropzone
 * @param {boolean}  [props.canDelete]      - Render delete buttons (admin only)
 * @param {string}   [props.userId]         - Current auth user id (uploader)
 * @param {Function} [props.onChange]       - Called after any successful upload / delete
 */
const EmployeeDocumentSection = ({
  employeeId,
  documentType = 'general',
  title = 'Employee Documents',
  accept,
  uploadText = 'Click to upload documents or pictures',
  uploadSubtext = 'PDF, PNG, JPG (Auto-compressed)',
  emptyText = 'No documents uploaded yet.',
  showStatus = false,
  canUpload = false,
  canDelete = false,
  userId,
  onChange
}) => {
  const [submissions, setSubmissions] = useState([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const inputId = `employee-doc-upload-${documentType}`;

  const loadDocuments = useCallback(async () => {
    if (!employeeId) return;
    setFetchingDocs(true);
    try {
      const docs = await getEmployeeSubmissions(employeeId, documentType);
      setSubmissions(docs || []);
    } catch (err) {
      console.error('Failed to load employee documents:', err);
    } finally {
      setFetchingDocs(false);
    }
  }, [employeeId, documentType]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Client-side guard: the picker's accept attribute can be bypassed (drag/drop, "All files")
  const isAllowedFile = (file) => {
    if (!accept) return true;
    const allowed = accept.split(',').map(t => t.trim()).filter(Boolean);
    return allowed.includes(file.type);
  };

  const handleFileUpload = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    const files = picked.filter(isAllowedFile);
    if (files.length !== picked.length) {
      alert('Only PDF, JPG and PNG files are allowed for this section.');
      if (files.length === 0) return;
    }
    if (!userId) {
      alert('User is not logged in');
      return;
    }

    setUploadingDocs(true);
    setUploadProgress({ current: 0, total: files.length, label: 'Compressing & uploading...' });

    try {
      await submitProofOfWork({
        employeeId,
        userId,
        comment: documentType === 'declaration' ? 'Employee Declaration Form' : 'Employee Document Upload',
        files,
        documentType,
        onProgress: (p) => setUploadProgress(p)
      });

      await loadDocuments();
      if (onChange) onChange();
    } catch (err) {
      console.error('File upload failed:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingDocs(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteDocument = async (submissionId, linkIndex, linksCount) => {
    if (!window.confirm('Are you sure you want to permanently delete this document?')) return;
    try {
      if (linksCount <= 1) {
        // Last link — delete the whole submission row
        await deleteSubmission(submissionId);
      } else {
        // More links remain — splice just this one
        const submission = submissions.find(s => s.id === submissionId);
        if (!submission) return;
        const updatedLinks = submission.links.filter((_, i) => i !== linkIndex);
        await updateSubmissionLinks(submissionId, updatedLinks);
      }
      await loadDocuments();
      if (onChange) onChange();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const fileCount = submissions.reduce((sum, sub) => sum + (sub.links?.length || 0), 0);
  const lastSubmission = submissions[0];

  return (
    <div className="form-section">
      <h3 className="form-section-header">{title}</h3>
      {fetchingDocs ? (
        <div className="loading-spinner">Loading documents...</div>
      ) : (
        <div className="documents-section-container">
          {showStatus && (
            <div className={`doc-status-banner ${fileCount > 0 ? 'doc-status-banner--ok' : 'doc-status-banner--missing'}`}>
              {fileCount > 0
                ? `Uploaded: ${fileCount} file(s), last on ${new Date(lastSubmission.created_at).toLocaleDateString()}`
                : 'Not uploaded'}
            </div>
          )}

          {canUpload && (
            <div className="upload-dropzone">
              <input
                type="file"
                id={inputId}
                multiple
                accept={accept}
                onChange={handleFileUpload}
                disabled={uploadingDocs}
                className="u-hidden"
              />
              <label htmlFor={inputId} className="upload-label">
                {uploadingDocs ? (
                  <div className="upload-progress-wrapper">
                    <div className="spinner-mini"></div>
                    <p className="progress-label-text">{uploadProgress?.label || 'Uploading...'}</p>
                    {uploadProgress && (
                      <div className="progress-bar-container">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="upload-icon">📤</span>
                    <span className="upload-text">{uploadText}</span>
                    <span className="upload-subtext">{uploadSubtext}</span>
                  </>
                )}
              </label>
            </div>
          )}

          <div className="documents-list">
            {submissions.length === 0 ? (
              <div className="no-documents-state">
                <span className="no-doc-icon">📄</span>
                <p>{emptyText}</p>
              </div>
            ) : (
              <div className="doc-grid">
                {submissions.flatMap((sub) =>
                  (sub.links || []).map((link, idx) => (
                    <div key={`${sub.id}-${idx}`} className="doc-card">
                      {canDelete && (
                        <button
                          type="button"
                          className="delete-doc-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteDocument(sub.id, idx, sub.links?.length ?? 1);
                          }}
                          title="Delete Document"
                          aria-label="Delete document"
                        >
                          <IconX size={12} />
                        </button>
                      )}
                      <div className="doc-preview">
                        {link.mime_type?.startsWith('image/') ? (
                          <img src={link.url} alt={link.file_name} className="doc-thumbnail" />
                        ) : (
                          <div className="doc-icon-placeholder">📄</div>
                        )}
                      </div>
                      <div className="doc-info">
                        <span className="doc-name" title={link.file_name}>{link.file_name}</span>
                        <span className="doc-meta">Uploaded on {new Date(sub.created_at).toLocaleDateString()}</span>
                        <span className="doc-uploader">By {sub.submitted_by_profile?.name || 'Unknown'}</span>
                      </div>
                      <div className="doc-actions">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="halo-button view-doc-btn">
                          View
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDocumentSection;
