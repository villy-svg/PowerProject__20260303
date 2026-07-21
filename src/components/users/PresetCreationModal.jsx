import React, { useState } from 'react';
import { IconX } from '../ui/Icons';
import '../../styles/ManagementForms.css';

/**
 * PresetCreationModal Component
 * Allows a master admin to create a new preset profile with a custom name.
 */
const PresetCreationModal = ({ onClose, onSave, loading }) => {
  const [presetName, setPresetName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    onSave(presetName.trim());
  };

  return (
    <div className="edit-modal-overlay modal-overlay">
      <div className="edit-modal user-role-modal modal-content">
        <header className="modal-header">
          <div className="modal-title-group">
            <h2>Create Preset Profile</h2>
            <span className="modal-subtitle">Define a new dummy preset profile</span>
          </div>
          <button className="close-modal" onClick={onClose} disabled={loading}>
            <IconX size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            <div className="form-group">
              <label className="section-label">
                Preset Profile Name
              </label>
              <div className="form-input-container">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., Preset: Junior Operator"
                  autoFocus
                  required
                />
              </div>
              <p className="sync-help-text u-mt-8 u-label-muted u-text-secondary">
                This will create a new preset user that can be used as a template for syncing permissions.
              </p>
            </div>
          </div>

          <div className="modal-footer sticky">
            <button type="button" className="halo-button cancel-btn" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button 
              type="submit" 
              className={`halo-button save-btn ${!presetName.trim() ? 'disabled' : ''}`}
              disabled={loading || !presetName.trim()}
            >
              {loading ? 'Creating...' : 'Create Preset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PresetCreationModal;
