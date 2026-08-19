// @prod-critical
import React from 'react';
import './MassSyncProgressModal.css';

/**
 * MassSyncProgressModal
 * Displays real-time progress of sequential permission syncing.
 */
const MassSyncProgressModal = ({ status, onClose }) => {
  return (
    <div className="modal-overlay mass-sync-modal__overlay">
      <div className="modal-content mass-sync-modal__content">
        <div className="modal-header">
          <h2>Mass Sync Progress</h2>
          {status.isComplete && <button className="close-modal" onClick={onClose}>×</button>}
        </div>
        <div className="modal-content-area mass-sync-modal__body">
          {!status.isComplete && <div className="status-message mass-sync-modal__in-progress-notice">Syncing in progress... Please do not close this window.</div>}
          {status.isComplete && <div className="status-message success">Sync process complete.</div>}
          
          <ul className="mass-sync-modal__result-list">
            {status.results?.map((res, i) => (
              <li key={i} className="mass-sync-modal__result-item">
                <span className={`mass-sync-modal__result-icon mass-sync-modal__result-icon--${res.status}`}>
                  {res.status === 'success' ? '✅' : '❌'}
                </span>
                <div className="mass-sync-modal__result-body">
                  <span className="mass-sync-modal__result-name">{res.name}</span>
                  <span className={`mass-sync-modal__result-msg mass-sync-modal__result-msg--${res.status}`}>
                    {res.message}
                  </span>
                </div>
              </li>
            ))}
            {!status.isComplete && (
              <li className="mass-sync-modal__processing-row">
                <span className="halo-spinner mass-sync-modal__spinner" />
                <span>Processing next user...</span>
              </li>
            )}
          </ul>
        </div>
        {status.isComplete && (
          <div className="modal-footer">
            <button className="halo-button" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MassSyncProgressModal;
