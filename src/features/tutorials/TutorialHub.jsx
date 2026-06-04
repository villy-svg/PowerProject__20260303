import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MasterPageHeader from '../../components/MasterPageHeader';
import TutorialSlideshowViewer from './TutorialSlideshowViewer';
import { TUTORIAL_FLOWS } from './flows';
import { fetchRules } from '../../services/employees/rulesService';
export { TUTORIAL_FLOWS };
import './TutorialSlideshowViewer.css';

/* ─── Parse Rule into Slides/Tutorial Pages ───────────────────── */
const parseRuleSlides = (title, content = '') => {
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
          description: `Interactive guidelines detailing ${rule.title}.`,
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

  // Compute final flows with static tutorial overrides applied
  const allFlows = useMemo(() => {
    const overriddenStaticFlows = TUTORIAL_FLOWS.map(flow => {
      const overrideKey = `powerpod_tutorial_override_${flow.id}`;
      const overridesStr = localStorage.getItem(overrideKey);
      if (!overridesStr) return flow;

      try {
        const overrides = JSON.parse(overridesStr);
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
        console.error('[TutorialHub] Override parse failed for flow:', flow.id, e);
        return flow;
      }
    });

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
          <button 
            className="halo-button header-back-dashboard-btn"
            onClick={() => setActiveVertical(null)}
          >
            ← Back to Dashboard
          </button>
        }
      />

      <div className="tutorial-categories-grid">
        {categories.map(category => (
          <div key={category} className="tutorial-category-section">
            <h3 className="category-section-title">{category}</h3>
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
          onClose={() => setActiveFlow(null)}
          user={user}
          permissions={permissions}
          onUpdate={loadRules}
        />
      )}
    </div>
  );
};

export default TutorialHub;
