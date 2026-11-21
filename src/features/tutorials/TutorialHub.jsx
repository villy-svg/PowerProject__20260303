import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import TutorialSlideshowViewer from './TutorialSlideshowViewer';
import TutorialFormModal from './TutorialFormModal';
import { TUTORIAL_FLOWS } from './flows';
import { fetchRules, deleteRule } from '../../services/employees/rulesService';
import {
  DEFAULT_STARTUP_TUTORIALS_CONFIG,
  fetchStartupTutorialsConfig,
  getConfiguredTutorialMode,
  updateStartupTutorialsConfig,
} from '../../services/core/systemSettingsService';
import { buildRuleFlow, parseRuleSlides } from './tutorialUtils';
import { useQuery } from '@tanstack/react-query';
import { IconEdit, IconPlus, IconTrash } from '../../components/ui/Icons';
export { TUTORIAL_FLOWS, parseRuleSlides };
import './TutorialHub.css';

const TutorialHub = ({ user, permissions, setActiveVertical, onShowBottomNav }) => {
  const [platform, setPlatform] = useState('desktop'); // 'desktop' | 'mobile'
  const [activeFlow, setActiveFlow] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [deletedTick, setDeletedTick] = useState(0); // re-evaluates locally-deleted static tutorials
  const [playAllQueue, setPlayAllQueue] = useState([]);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(-1);
  const [startupConfig, setStartupConfig] = useState(DEFAULT_STARTUP_TUTORIALS_CONFIG);
  const [startupConfigSavingId, setStartupConfigSavingId] = useState(null);

  const { data: rulesData = [], refetch: refetchRulesData } = useQuery({
    queryKey: ['employee_rules', { activeOnly: true }],
    queryFn: () => fetchRules({ activeOnly: true }),
  });

  // Lookup map from flow.id ('rule_<id>') to raw DB rule for default startup mode resolution
  const ruleByFlowId = useMemo(() => {
    const map = {};
    rulesData.forEach((rule) => {
      map[`rule_${rule.id}`] = rule;
    });
    return map;
  }, [rulesData]);

  // Use shared buildRuleFlow helper so metadata & per-slide textAlign stay in sync with App.jsx
  const ruleFlows = useMemo(() => rulesData.map(buildRuleFlow), [rulesData]);

  const loadRules = useCallback(() => {
    refetchRulesData();
  }, [refetchRulesData]);

  const isMasterAdmin = user?.roleId === 'master_admin' || permissions?.canManageRoles;
  // RLS on system_app_settings strictly requires role_id = 'master_admin'
  const isStrictMasterAdmin = user?.roleId === 'master_admin';

  useEffect(() => {
    if (!isStrictMasterAdmin) return;
    let cancelled = false;
    fetchStartupTutorialsConfig().then((cfg) => {
      if (!cancelled) setStartupConfig(cfg);
    });
    return () => { cancelled = true; };
  }, [isStrictMasterAdmin]);

  const handleSetTutorialStartupMode = async (e, flowId, nextMode) => {
    e.stopPropagation();
    if (!isStrictMasterAdmin || startupConfigSavingId) return;

    const currentMode = getConfiguredTutorialMode(flowId, startupConfig, ruleByFlowId[flowId]);
    if (currentMode === nextMode) return;

    const prevConfig = startupConfig;
    const nextConfig = {
      ...prevConfig,
      per_tutorial: {
        ...(prevConfig.per_tutorial || {}),
        [flowId]: nextMode,
      },
    };

    setStartupConfig(nextConfig);
    setStartupConfigSavingId(flowId);
    try {
      const saved = await updateStartupTutorialsConfig(nextConfig, user?.id);
      setStartupConfig(saved);
    } catch (err) {
      console.error('[TutorialHub] Failed to save per-tutorial startup mode:', err);
      setStartupConfig(prevConfig);
      alert(`Failed to update startup mode: ${err.message || err}`);
    } finally {
      setStartupConfigSavingId(null);
    }
  };

  // Master-admin only: delete a tutorial.
  // DB-backed tutorials (rule_*) are deleted from employee_rules;
  // built-in static tutorials are hidden via a local-storage marker.
  const handleDeleteTutorial = async (flow) => {
    if (!isMasterAdmin) return;
    if (!window.confirm(`Delete the tutorial "${flow.title}"? This cannot be undone.`)) return;
    try {
      if (String(flow.id).startsWith('rule_')) {
        await deleteRule(String(flow.id).replace(/^rule_/, ''));
        refetchRulesData();
      } else {
        localStorage.setItem(`powerpod_tutorial_deleted_${flow.id}`, '1');
        setDeletedTick(t => t + 1);
      }
    } catch (e) {
      console.error('[TutorialHub] Delete failed:', e);
      alert('Failed to delete tutorial.');
    }
  };

  const handlePlayAll = (categoryName) => {
    const categoryFlows = allFlows.filter(f => f.category === categoryName);
    if (categoryFlows.length > 0) {
      setPlayAllQueue(categoryFlows);
      setCurrentPlayIndex(0);
      setActiveFlow(categoryFlows[0]);
    }
  };

  const handleViewerClose = (completed = false) => {
    if (completed && currentPlayIndex >= 0 && currentPlayIndex < playAllQueue.length - 1) {
      const nextIndex = currentPlayIndex + 1;
      setCurrentPlayIndex(nextIndex);
      setActiveFlow(playAllQueue[nextIndex]);
    } else {
      setPlayAllQueue([]);
      setCurrentPlayIndex(-1);
      setActiveFlow(null);
    }
  };

  const allFlows = useMemo(() => {
    const applyOverrides = (flow) => {
      // 0. Apply metadata overrides (title, description, category) from local storage
      const metaOverrideKey = `powerpod_tutorial_meta_override_${flow.id}`;
      const metaOverrideStr = localStorage.getItem(metaOverrideKey);
      if (metaOverrideStr) {
        try {
          const parsedMeta = JSON.parse(metaOverrideStr);
          flow = {
            ...flow,
            title: parsedMeta.title ?? flow.title,
            description: parsedMeta.description ?? flow.description,
            category: parsedMeta.category ?? flow.category
          };
        } catch (e) {
          console.error('[TutorialHub] Meta override parse failed:', e);
        }
      }

      // 1. Check for full array override (supports add/delete slides)
      const arrayOverrideKey = `powerpod_tutorial_override_array_${flow.id}`;
      const arrayOverrideStr = localStorage.getItem(arrayOverrideKey);
      if (arrayOverrideStr) {
        try {
          const parsedArray = JSON.parse(arrayOverrideStr);
          if (Array.isArray(parsedArray)) {
            return {
              ...flow,
              desktopSlides: parsedArray,
              mobileSlides: parsedArray
            };
          }
        } catch (e) {
          console.error('[TutorialHub] Array override parse failed:', e);
        }
      }

      // 2. Check for legacy index-based override (legacy support)
      const legacyOverrideKey = `powerpod_tutorial_override_${flow.id}`;
      const legacyOverrideStr = localStorage.getItem(legacyOverrideKey);
      if (legacyOverrideStr) {
        try {
          const overrides = JSON.parse(legacyOverrideStr);
          const mapOverride = (slidesList) => slidesList.map((slide, idx) => {
            if (overrides[idx]) {
              return {
                ...slide,
                title: overrides[idx].title ?? slide.title,
                text: overrides[idx].text ?? slide.text ?? slide.caption,
                caption: overrides[idx].text ?? slide.caption
              };
            }
            return slide;
          });
          return {
            ...flow,
            desktopSlides: mapOverride(flow.desktopSlides || []),
            mobileSlides: mapOverride(flow.mobileSlides || [])
          };
        } catch (e) {
          console.error('[TutorialHub] Legacy override parse failed:', e);
        }
      }

      return flow;
    };

    const overriddenStaticFlows = TUTORIAL_FLOWS.filter(f => !localStorage.getItem(`powerpod_tutorial_deleted_${f.id}`)).map(applyOverrides);
    return [...overriddenStaticFlows, ...ruleFlows];
  }, [ruleFlows, deletedTick]);

  // Sync activeFlow reference if ruleFlows gets reloaded
  useEffect(() => {
    if (activeFlow) {
      const updated = allFlows.find(f => f.id === activeFlow.id);
      if (updated) setActiveFlow(updated);
    }
  }, [allFlows, activeFlow]);

  const categories = useMemo(() => Array.from(new Set(allFlows.map(f => f.category))), [allFlows]);

  // Normalize tutorial flows for records-mode SearchBar (matches title, description, category, and slide content)
  const tutorialSearchRecords = useMemo(() => {
    return allFlows.map(flow => {
      const slides = [...(flow.desktopSlides || []), ...(flow.mobileSlides || [])];
      const slideText = slides
        .map(s => `${s.title || ''} ${s.text || ''} ${s.caption || ''}`)
        .join(' ');
      return {
        ...flow,
        search_text: slideText,
      };
    });
  }, [allFlows]);

  const handleSearchSelect = useCallback((record) => {
    if (!record) return;
    const matchedFlow = allFlows.find(f => f.id === record.id) || record;
    setActiveFlow(matchedFlow);
  }, [allFlows]);

  const handleSearchEdit = useCallback((record) => {
    if (!record || !isMasterAdmin) return;
    const matchedFlow = allFlows.find(f => f.id === record.id) || record;
    setEditingFlow(matchedFlow);
    setIsFormOpen(true);
  }, [allFlows, isMasterAdmin]);

  return (
    <div className="management-view-container tutorial-hub-page">
      <MasterPageHeader
        title="System Tutorials"
        description="Explore step-by-step interactive slideshows detailing standard user tasks and manager normalisation flows."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        searchRecords={tutorialSearchRecords}
        recordType="Tutorial"
        onSearchSelect={handleSearchSelect}
        onSearchEdit={isMasterAdmin ? handleSearchEdit : undefined}
        expandedLeft={
          <div className="platform-toggle-container">
            <div className="platform-toggle-label">Target Environment:</div>
            <div className="board-view-toggle" role="group" aria-label="Target Environment">
              <button 
                type="button"
                className={`view-toggle-btn ${platform === 'desktop' ? 'active' : ''}`}
                aria-pressed={platform === 'desktop'}
                onClick={() => setPlatform('desktop')}
              >
                Desktop View
              </button>
              <button 
                type="button"
                className={`view-toggle-btn ${platform === 'mobile' ? 'active' : ''}`}
                aria-pressed={platform === 'mobile'}
                onClick={() => setPlatform('mobile')}
              >
                Mobile View
              </button>
            </div>
          </div>
        }
        rightActions={
          <div className="u-flex-center-gap">
            {isMasterAdmin && (
              <button 
                className="halo-button master-action-btn"
                onClick={() => {
                  setEditingFlow(null);
                  setIsFormOpen(true);
                }}
              >
                <IconPlus size={16} /> Add Tutorial
              </button>
            )}
            <button 
              className="halo-button header-back-dashboard-btn"
              onClick={() => setActiveVertical(null)}
            >
              ← Back to Dashboard
            </button>
          </div>
        }
      />

      <div className="tutorial-categories-grid">
        {categories.map(category => (
          <div key={category} className="tutorial-category-section">
            <div className="u-flex-between u-mb-16 u-flex-wrap-gap-8">
              <h3 className="category-section-title u-m-0">{category}</h3>
              <button 
                className="halo-button secondary play-all-btn" 
                onClick={() => handlePlayAll(category)}
              >
                ▶ Play All
              </button>
            </div>
            <div className="category-flows-grid">
              {allFlows.filter(f => f.category === category).map(flow => (
                <div 
                  key={flow.id} 
                  className="tutorial-flow-card"
                  onClick={() => setActiveFlow(flow)}
                >
                  <div className="flow-card-header">
                    <span 
                      className="access-level-badge"
                    >
                      {flow.accessLevel} Scope
                    </span>
                    <div className="flow-card-actions">
                      {isMasterAdmin && (
                        <button
                          className="halo-button secondary btn-icon edit-tutorial-info-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFlow(flow);
                            setIsFormOpen(true);
                          }}
                          title="Edit Title / Description"
                          aria-label="Edit Title / Description"
                        >
                          <IconEdit size={12} />
                        </button>
                      )}
                      {isMasterAdmin && (
                        <button
                          className="halo-button danger btn-icon delete-tutorial-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTutorial(flow);
                          }}
                          title="Delete Tutorial"
                          aria-label="Delete Tutorial"
                        >
                          <IconTrash size={12} />
                        </button>
                      )}
                      <span className="flow-indicator-icon">▶</span>
                    </div>
                  </div>
                  <h4 className="flow-card-title">{flow.title}</h4>
                  <p className="flow-card-description">{flow.description}</p>
                  {isStrictMasterAdmin && (() => {
                    const configuredMode = getConfiguredTutorialMode(flow.id, startupConfig, ruleByFlowId[flow.id]);
                    const isGlobalOff = !startupConfig.compulsory_show && !startupConfig.skippable_show;
                    const isGlobalSkippable = !startupConfig.compulsory_show && startupConfig.skippable_show;
                    const labelSuffix = isGlobalOff
                      ? ' (Global Off)'
                      : (isGlobalSkippable && configuredMode === 'compulsory' ? ' (Global Skippable)' : '');

                    return (
                      <div
                        className="flow-card-startup-row"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="flow-card-startup-label">Startup{labelSuffix}</span>
                        <div className="board-view-toggle" role="group" aria-label={`Startup mode for ${flow.title}`}>
                          <button
                            type="button"
                            className={`view-toggle-btn ${configuredMode === 'off' ? 'active' : ''}`}
                            aria-pressed={configuredMode === 'off'}
                            disabled={startupConfigSavingId === flow.id}
                            onClick={(e) => handleSetTutorialStartupMode(e, flow.id, 'off')}
                          >
                            Off
                          </button>
                          <button
                            type="button"
                            className={`view-toggle-btn ${configuredMode === 'skippable' ? 'active' : ''}`}
                            aria-pressed={configuredMode === 'skippable'}
                            disabled={startupConfigSavingId === flow.id}
                            onClick={(e) => handleSetTutorialStartupMode(e, flow.id, 'skippable')}
                          >
                            Skip
                          </button>
                          <button
                            type="button"
                            className={`view-toggle-btn ${configuredMode === 'compulsory' ? 'active' : ''}`}
                            aria-pressed={configuredMode === 'compulsory'}
                            disabled={startupConfigSavingId === flow.id}
                            onClick={(e) => handleSetTutorialStartupMode(e, flow.id, 'compulsory')}
                          >
                            Compulsory
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flow-card-footer">
                    <button 
                      className={`halo-button flow-version-btn ${platform === 'desktop' ? 'active-version' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlatform('desktop');
                        setActiveFlow(flow);
                      }}
                    >
                      <span className="version-btn-title">Desktop Version</span>
                      <span className="version-btn-subtitle">{flow.desktopSlides?.length || 0} Steps</span>
                    </button>
                    <button 
                      className={`halo-button flow-version-btn ${platform === 'mobile' ? 'active-version' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlatform('mobile');
                        setActiveFlow(flow);
                      }}
                    >
                      <span className="version-btn-title">Mobile Version</span>
                      <span className="version-btn-subtitle">{flow.mobileSlides?.length || 0} Steps</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeFlow && (
        <TutorialSlideshowViewer
          flow={activeFlow}
          platform={platform}
          onClose={handleViewerClose}
          user={user}
          permissions={permissions}
          onUpdate={loadRules}
        />
      )}

      {isFormOpen && (
        <TutorialFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          editingItem={editingFlow}
          user={user}
          onSave={loadRules}
        />
      )}
    </div>
  );
};

export default TutorialHub;
