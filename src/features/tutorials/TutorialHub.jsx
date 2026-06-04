import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MasterPageHeader from '../../components/MasterPageHeader';
import TutorialSlideshowViewer from './TutorialSlideshowViewer';
import TutorialFormModal from './TutorialFormModal';
import { TUTORIAL_FLOWS } from './flows';
import { fetchRules } from '../../services/employees/rulesService';
import { IconEdit, IconPlus } from '../../components/Icons';
export { TUTORIAL_FLOWS };
import './TutorialSlideshowViewer.css';

/* ─── Parse Rule into Slides/Tutorial Pages ───────────────────── */
export const parseRuleSlides = (title, content = '') => {
  const trimmedContent = content.replace(/^\s*\n+|\n+\s*$/g, '');
  const lines = trimmedContent.split('\n').map(l => l.trim());
  const introLines = [];
  const bullets = []; // Array of { title: string | null, text: string }

  lines.forEach(line => {
    const isBullet = /^[•\*\-\u2022]/.test(line) || /^\d+[\.\)]/.test(line);
    if (isBullet) {
      let cleaned = line.replace(/^[•\*\-\u2022\s\d+\.\)]+/, '').trim();
      let bulletTitle = null;
      if (cleaned.startsWith('### ')) {
        bulletTitle = cleaned.substring(4).trim();
        cleaned = '';
      }
      bullets.push({ title: bulletTitle, text: cleaned });
    } else {
      if (bullets.length === 0) {
        introLines.push(line);
      } else {
        let lastBullet = bullets[bullets.length - 1];
        if (lastBullet.text === '') {
          lastBullet.text = line;
        } else {
          lastBullet.text += '\n' + line;
        }
      }
    }
  });

  const slides = [];
  
  slides.push({
    title: title,
    text: introLines.join('\n'),
    isIntro: true
  });

  bullets.forEach((bullet, index) => {
    slides.push({
      title: bullet.title || `Point ${index + 1} of ${bullets.length}`,
      text: bullet.text,
      isIntro: false
    });
  });

  if (slides.length === 1 && content && introLines.join('\n') !== content) {
    const paragraphs = content.split('\n\n').map(p => p.trim()).filter(Boolean);
    if (paragraphs.length > 1) {
      paragraphs.forEach((p, idx) => {
        if (idx === 0) {
          slides[0].text = p;
        } else {
          slides.push({
            title: `Detail ${idx + 1}`,
            text: p,
            isIntro: false
          });
        }
      });
    }
  }

  return slides;
};

const TutorialHub = ({ user, permissions, setActiveVertical, onShowBottomNav }) => {
  const [platform, setPlatform] = useState('desktop'); // 'desktop' | 'mobile'
  const [activeFlow, setActiveFlow] = useState(null);
  const [ruleFlows, setRuleFlows] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [playAllQueue, setPlayAllQueue] = useState([]);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(-1);

  const isMasterAdmin = user?.roleId === 'master_admin' || permissions?.canManageRoles;

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

  const loadRules = useCallback(async () => {
    try {
      const rulesData = await fetchRules({ activeOnly: true });
      const generated = rulesData.map(rule => {
        const parsedSlides = parseRuleSlides(rule.title, rule.content || '');
        const flowSlides = parsedSlides.map((slide) => ({
          image: '/powerpod-logo.svg',
          fallbackImage: '/powerpod-logo.svg',
          title: slide.isIntro ? rule.title : slide.title,
          text: slide.text,
          annotations: []
        }));

        return {
          id: `rule_${rule.id}`,
          title: rule.title,
          category: rule.category?.name || 'Rules & Regulations',
          category_id: rule.category_id,
          content: rule.content,
          description: rule.impact || `Interactive guidelines detailing ${rule.title}.`,
          accessLevel: 'All Users',
          badgeColor: 'rgba(16, 185, 129, 0.1)',
          badgeText: '#10b981',
          layout: 'onboarding',
          desktopSlides: flowSlides,
          mobileSlides: flowSlides
        };
      });
      setRuleFlows(generated);
    } catch (err) {
      console.error('[TutorialHub] Error loading rules tutorials:', err);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

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

    const overriddenStaticFlows = TUTORIAL_FLOWS.map(applyOverrides);
    return [...overriddenStaticFlows, ...ruleFlows];
  }, [ruleFlows]);

  // Sync activeFlow reference if ruleFlows gets reloaded
  useEffect(() => {
    if (activeFlow) {
      const updated = allFlows.find(f => f.id === activeFlow.id);
      if (updated) setActiveFlow(updated);
    }
  }, [allFlows, activeFlow]);

  const categories = useMemo(() => Array.from(new Set(allFlows.map(f => f.category))), [allFlows]);

  return (
    <div className="management-view-container tutorial-hub-page">
      <MasterPageHeader
        title="System Tutorials"
        description="Explore step-by-step interactive slideshows detailing standard user tasks and manager normalisation flows."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        expandedLeft={
          <div className="platform-toggle-container">
            <div className="platform-toggle-label">Target Environment:</div>
            <div className="platform-selector-group">
              <button 
                className={`platform-toggle-btn ${platform === 'desktop' ? 'active' : ''}`}
                onClick={() => setPlatform('desktop')}
              >
                Desktop View
              </button>
              <button 
                className={`platform-toggle-btn ${platform === 'mobile' ? 'active' : ''}`}
                onClick={() => setPlatform('mobile')}
              >
                Mobile View
              </button>
            </div>
          </div>
        }
        rightActions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isMasterAdmin && (
              <button 
                className="halo-button header-back-dashboard-btn"
                style={{ borderColor: 'var(--brand-green)', color: 'var(--brand-green)' }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 className="category-section-title" style={{ margin: 0 }}>{category}</h3>
              <button 
                className="halo-button secondary play-all-btn" 
                style={{ minWidth: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '32px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
                      style={{ 
                        backgroundColor: flow.badgeColor,
                        color: flow.badgeText,
                        border: `1px solid ${flow.badgeText}33`
                      }}
                    >
                      {flow.accessLevel} Scope
                    </span>
                    {isMasterAdmin && (
                      <button
                        className="halo-button secondary edit-tutorial-info-btn"
                        style={{ minWidth: 'auto', width: '32px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFlow(flow);
                          setIsFormOpen(true);
                        }}
                        title="Edit Title / Description"
                      >
                        <IconEdit size={12} />
                      </button>
                    )}
                    <span className="flow-indicator-icon">▶</span>
                  </div>
                  <h4 className="flow-card-title">{flow.title}</h4>
                  <p className="flow-card-description">{flow.description}</p>
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
