import React from 'react';
import { ROLE_SCOPES, ROLE_LEVELS } from '../../constants/roles';
import { VERTICAL_LIST } from '../../constants/verticals';
import { VERTICAL_FEATURES } from '../../constants/verticalFeatures';
import { LEVEL_RANKS } from './useUserManagement';
import { IconX } from '../ui/Icons';
import RoleTooltip from '../ui/RoleTooltip';

/**
 * UserEditorModal Component
 * The "Force Field" configurator for user permissions.
 * Includes hierarchical capping logic to ensure feature-level ranks don't exceed parent ranks.
 */
const UserEditorModal = (props) => {
  const {
    user,
    users,
    loadPresetPermissions,
    roleScope,
    setRoleScope,
    roleLevel,
    onLevelChange,
    verticalPermissions,
    onVerticalLevelChange,
    onFeatureLevelChange,
    expandedVertical,
    setExpandedVertical,
    onClose,
    onSave,
    loading
  } = props;

  const mapVerticalLabel = (label) => {
    if (!label) return '';
    const clean = label.trim().toLowerCase();
    if (clean === 'hub manager' || clean === 'hub') return 'Hubs';
    if (clean === 'client manager' || clean === 'client') return 'Clients';
    if (clean === 'employee manager' || clean === 'employee') return 'Employees';
    if (clean === 'partner manager' || clean === 'partner') return 'Partners';
    if (clean === 'vendor manager' || clean === 'vendor') return 'Vendors';
    if (clean === 'data manager' || clean === 'data') return 'Data';
    return label;
  };

  if (!user) return null;

  return (
    <div className="edit-modal-overlay">
      <div className="edit-modal user-role-modal">
        <header className="modal-header">
          <div className="modal-title-group">
            <h3>Configure Access: {user.name}</h3>
            <span className="modal-subtitle">{user.email}</span>
          </div>
          <button className="close-modal" onClick={onClose}>
            <IconX size={20} />
          </button>
        </header>
        
        <form onSubmit={onSave}>
          <div className="preset-selector-section u-px-20 u-py-16 u-border-b-light">
            <div className="form-group u-max-w-400 u-p-0">
              <label className="section-label u-mb-8 u-block">Load from Preset Profile (Optional)</label>
              {users && users.length > 0 ? (
                <div className="form-input-container">
                  <select
                    className="master-dropdown"
                    onChange={(e) => loadPresetPermissions(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>Select a preset to clone its permissions...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="u-text-13px u-opacity-50">No preset profiles exist yet. Create one from the Users/Presets toggle.</span>
              )}
            </div>
          </div>

          <div className="role-config-grid">
            {/* 1. Scope Selection */}
            <div className="form-section">
              <label className="section-label">1. Select Access Scope</label>
              <div className="scope-options">
                {ROLE_SCOPES.map(scope => (
                  <div 
                    key={scope.id} 
                    className={`scope-card ${roleScope === scope.id ? 'active' : ''}`}
                    onClick={() => setRoleScope(scope.id)}
                  >
                    <div className="radio-circle"></div>
                    <div className="scope-info">
                      <span className="scope-name">{scope.label}</span>
                      <span className="scope-desc">{scope.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Capability Level Selection */}
            <div className="form-section">
              <label className="section-label">2. Select Capability Level</label>
              <div className="level-options">
                {ROLE_LEVELS.map(level => (
                  <div 
                    key={level.id} 
                    className={`level-card ${roleLevel === level.id ? 'active' : ''}`}
                    onClick={() => onLevelChange(level.id)}
                  >
                    <div className="radio-circle"></div>
                    <div className="level-info">
                      <span className="level-name">{level.label}</span>
                      <span className="level-desc">{level.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Granular Vertical Permissions (Only for Vertical Scope) */}
          {roleScope === 'vertical' && (
            <div className="form-section vertical-assignment-section">
              <label className="section-label">3. Configure Vertical Access Levels</label>
              <div className="vertical-permission-list">
                {VERTICAL_LIST.map(v => {
                  const vData = verticalPermissions[v.id];
                  const normalizedVLevel = typeof vData === 'object' ? vData.level : (vData || 'none');
                  
                  return (
                    <div key={v.id} className="vertical-perm-item-wrapper">
                      <div className="vertical-perm-item">
                        <div className="left-side-controls">
                          {VERTICAL_FEATURES[v.id] && normalizedVLevel !== 'none' && (
                            <button
                               type="button"
                               className={`features-toggle-btn ${expandedVertical === v.id ? 'active' : ''}`}
                               onClick={() => setExpandedVertical(expandedVertical === v.id ? null : v.id)}
                            >
                              <span className={`chevron ${expandedVertical === v.id ? 'up' : 'down'}`}></span>
                            </button>
                          )}
                          <span className="v-name">{mapVerticalLabel(v.label)}</span>
                        </div>
                        
                        <div className="v-level-selector">
                          {['none', 'viewer', 'contributor', 'editor', 'admin'].map(lvl => {
                            const maxRank = LEVEL_RANKS[roleLevel] || 1;
                            const isTooHigh = LEVEL_RANKS[lvl] > maxRank;

                            return (
                              <RoleTooltip
                                key={lvl}
                                level={lvl}
                                contextName={mapVerticalLabel(v.label)}
                                isFeature={false}
                              >
                                <button
                                  type="button"
                                  className={`v-lvl-btn ${normalizedVLevel === lvl ? 'active' : ''} lvl-${lvl}`}
                                  onClick={() => !isTooHigh && onVerticalLevelChange(v.id, lvl)}
                                  disabled={isTooHigh}
                                  title={isTooHigh ? `Locked by max capability level (${roleLevel.toUpperCase()})` : ''}
                                  style={{ opacity: isTooHigh ? 0.3 : 1, cursor: isTooHigh ? 'not-allowed' : 'pointer' }}
                                >
                                  {lvl.toUpperCase()}
                                </button>
                              </RoleTooltip>
                            );
                          })}
                        </div>
                      </div>

                        {expandedVertical === v.id && VERTICAL_FEATURES[v.id] && (
                        <div className="features-dropdown">
                          <p className="features-header">Configure feature-specific levels for {mapVerticalLabel(v.label)}:</p>
                          <div className="features-level-list">
                            {VERTICAL_FEATURES[v.id].map(feature => {
                              // fLevelRaw is the explicit DB row value (undefined = no override)
                              const fLevelRaw = verticalPermissions[v.id]?.features?.[feature.id];
                              // Displayed level: explicit override if set, else fall back to vertical level
                              const fLevel = fLevelRaw || normalizedVLevel;
                              // hasOverride: there is a real feature_access row for this feature
                              const hasOverride = fLevelRaw !== undefined && fLevelRaw !== null;
                              return (
                                <div key={feature.id} className={`feature-level-row${hasOverride ? ' feature-level-row--overridden' : ''}`}>
                                  <div className="feature-label-group">
                                    <span className="feature-label">{feature.label}</span>
                                    {hasOverride && (
                                      <span className="feature-override-tag" title="Explicitly set — not inherited from vertical">override</span>
                                    )}
                                  </div>
                                  <div className="v-level-selector mini">
                                    {['none', 'viewer', 'contributor', 'editor', 'admin'].map(lvl => {
                                      const globalMaxRank = LEVEL_RANKS[roleLevel] || 1;
                                      const verticalMaxRank = LEVEL_RANKS[normalizedVLevel] || 1;
                                      const isTooHigh = LEVEL_RANKS[lvl] > Math.min(globalMaxRank, verticalMaxRank);
                                      
                                      return (
                                        <RoleTooltip
                                          key={lvl}
                                          level={lvl}
                                          contextName={feature.label}
                                          isFeature={true}
                                        >
                                          <button
                                            type="button"
                                            className={`v-lvl-btn ${fLevel === lvl ? 'active' : ''} lvl-${lvl}`}
                                            onClick={() => !isTooHigh && onFeatureLevelChange(v.id, feature.id, lvl)}
                                            disabled={isTooHigh}
                                            title={isTooHigh ? `Locked by vertical access level (${normalizedVLevel.toUpperCase()})` : ''}
                                            style={{ opacity: isTooHigh ? 0.3 : 1 }}
                                          >
                                            {lvl.charAt(0).toUpperCase()}
                                          </button>
                                        </RoleTooltip>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {Object.values(verticalPermissions).every(data => (typeof data === 'object' ? data.level : data) === 'none') && (
                <p className="selection-warning">⚠️ No access granted to any vertical.</p>
              )}
            </div>
          )}

          {roleScope === 'master' && (
            <div className="master-scope-notice highlight-box">
              <p>✨ <strong>Master Scope</strong> grants automatic read/write access to all current and future verticals.</p>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="halo-button save-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Sync & Harden Permissions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserEditorModal;
