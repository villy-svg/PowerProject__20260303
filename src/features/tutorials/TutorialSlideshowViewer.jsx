import React, { useState, useEffect } from 'react';
import { IconX, IconChevronLeft, IconChevronRight } from '../../components/Icons';
import { updateRule } from '../../services/employees/rulesService';
import './TutorialSlideshowViewer.css';

const TutorialSlideshowViewer = ({ flow, platform, onClose, user, permissions, onUpdate }) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  // Pick slides based on target environment
  const slides = platform === 'desktop' ? flow.desktopSlides : flow.mobileSlides;
  const currentSlide = slides[slideIndex];

  // Initialize edit form when slide or edit mode changes
  useEffect(() => {
    if (currentSlide) {
      setEditTitle(currentSlide.title || '');
      setEditText(currentSlide.text || currentSlide.caption || '');
    }
  }, [slideIndex, currentSlide, isEditing]);

  if (!currentSlide) return null;

  const isMasterAdmin = user?.roleId === 'master_admin' || permissions?.canManageRoles;

  const handleNext = () => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (flow.id.startsWith('rule_')) {
        // Reconstruct rule content from updated slides
        const ruleId = flow.id.replace('rule_', '');
        const updatedSlides = [...slides];
        updatedSlides[slideIndex] = {
          ...updatedSlides[slideIndex],
          title: editTitle,
          text: editText
        };

        const newTitle = updatedSlides[0].title;
        const introText = updatedSlides[0].text;
        const bulletTexts = updatedSlides.slice(1).map(s => s.text);
        const bulletContent = bulletTexts.map((text, idx) => `${idx + 1}. ${text}`).join('\n');
        const newContent = [introText, bulletContent].filter(Boolean).join('\n');

        await updateRule(ruleId, {
          title: newTitle,
          content: newContent
        });
      } else {
        // For static tutorials, save individual slide override in localStorage
        const overrideKey = `powerpod_tutorial_override_${flow.id}`;
        const overrides = JSON.parse(localStorage.getItem(overrideKey) || '{}');
        overrides[slideIndex] = { title: editTitle, text: editText };
        localStorage.setItem(overrideKey, JSON.stringify(overrides));
      }

      if (onUpdate) {
        await onUpdate();
      }
      setIsEditing(false);
    } catch (err) {
      alert('Failed to save slide content: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderEditControls = () => {
    if (!isMasterAdmin) return null;
    if (isEditing) {
      return (
        <div className="slide-edit-controls-bar" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button className="halo-button secondary" onClick={() => setIsEditing(false)} disabled={saving} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
            Cancel
          </button>
          <button className="halo-button save-btn" onClick={handleSave} disabled={saving} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', '--stage-accent': 'var(--brand-green)' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      );
    }
    return (
      <div className="slide-edit-trigger" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="halo-button secondary" onClick={() => setIsEditing(true)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
          ✏️ Edit Slide Text
        </button>
      </div>
    );
  };

  if (flow.layout === 'onboarding') {
    return (
      <div className="tutorial-slideshow-overlay onboarding-overlay animate-fade-in">
        <div className="slideshow-onboarding-card">
          <div className="onboarding-header">
            {slideIndex > 0 ? (
              <button className="onboarding-back-btn" onClick={handlePrev} aria-label="Go back">
                <IconChevronLeft size={20} />
              </button>
            ) : (
              <div className="onboarding-back-placeholder" />
            )}
            <button className="onboarding-skip-btn" onClick={onClose}>Skip</button>
          </div>
          
          <div className="onboarding-content-body">
            <div className="onboarding-image-container">
               <img 
                 src={currentSlide.image} 
                 alt={currentSlide.title} 
                 className="onboarding-image"
                 onError={(e) => {
                   e.target.src = currentSlide.fallbackImage || currentSlide.image;
                 }}
               />
            </div>
            
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '1rem' }}>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={e => setEditTitle(e.target.value)} 
                  placeholder="Slide Title"
                  disabled={flow.id.startsWith('rule_') && slideIndex > 0}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px', 
                    color: '#fff', 
                    fontSize: '1.1rem', 
                    fontWeight: 'bold',
                    opacity: (flow.id.startsWith('rule_') && slideIndex > 0) ? 0.5 : 1
                  }}
                />
                <textarea 
                  value={editText} 
                  onChange={e => setEditText(e.target.value)} 
                  placeholder="Slide Content Text"
                  rows={4}
                  style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>
            ) : (
              <>
                <h2 className="onboarding-title">{currentSlide.title}</h2>
                <p className="onboarding-text" style={{ whiteSpace: 'pre-wrap' }}>{currentSlide.text}</p>
              </>
            )}
            {renderEditControls()}
          </div>
          
          <div className="onboarding-footer">
            <div className="slideshow-step-dots onboarding-dots">
              {slides.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`step-dot-indicator ${slideIndex === idx ? 'active' : ''}`}
                  onClick={() => setSlideIndex(idx)}
                />
              ))}
            </div>
            
            <button 
              className="halo-button onboarding-next-btn"
              onClick={handleNext}
              disabled={isEditing}
              style={{ '--stage-accent': 'var(--brand-green)' }}
            >
              {slideIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tutorial-slideshow-overlay animate-fade-in">
      <div className="slideshow-modal-card">
        {/* Header bar of modal */}
        <div className="slideshow-modal-header">
          <div className="slideshow-header-info">
            <span className="flow-category-label">{flow.category}</span>
            <h3 className="slideshow-flow-title">{flow.title}</h3>
          </div>
          <button className="slideshow-close-btn" onClick={onClose}>
            <IconX size={20} />
          </button>
        </div>

        {/* Core screenshot & annotations area */}
        <div className="slideshow-content-body">
          <div className="screenshot-wrapper-container">
            <img 
              src={currentSlide.image} 
              alt={`Slide ${slideIndex + 1}`} 
              className="tutorial-screenshot-img"
              onError={(e) => {
                e.target.src = currentSlide.fallbackImage || currentSlide.image;
              }}
            />

            {/* Dynamic Annotations Layer */}
            <div className="annotations-overlay-layer">
              {currentSlide.annotations?.map((ann, idx) => {
                if (ann.type === 'circle') {
                  return (
                    <div 
                      key={idx}
                      className="annotation-highlight-circle"
                      style={{
                        top: `${ann.top}%`,
                        left: `${ann.left}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`
                      }}
                    >
                      {ann.label && (
                        <div className="circle-annotation-label-box">
                          {ann.label}
                        </div>
                      )}
                    </div>
                  );
                }

                if (ann.type === 'thought') {
                  const alignStyle = ann.align === 'right' 
                    ? { transform: 'translate(-85%, -120%)' } 
                    : ann.align === 'left'
                    ? { transform: 'translate(-15%, -120%)' }
                    : ann.align === 'bottom-right'
                    ? { transform: 'translate(-85%, 20px)' }
                    : ann.align === 'bottom-left'
                    ? { transform: 'translate(-15%, 20px)' }
                    : {};
                  const anchorLeft = ann.align === 'right' || ann.align === 'bottom-right'
                    ? '85%' 
                    : ann.align === 'left' || ann.align === 'bottom-left'
                    ? '15%'
                    : '50%';
                  return (
                    <div 
                      key={idx}
                      className={`annotation-thought-bubble animate-fade-in ${ann.align ? `align-${ann.align}` : ''}`}
                      style={{
                        top: `${ann.top}%`,
                        left: `${ann.left}%`,
                        ...alignStyle
                      }}
                    >
                      <div className="thought-bubble-pulse" style={{ left: anchorLeft }}></div>
                      <div className="thought-bubble-text">
                        {ann.text}
                      </div>
                      <div className="thought-bubble-pointer" style={{ left: anchorLeft }}></div>
                    </div>
                  );
                }

                return null;
              })}

              {/* Dynamic Responsive SVG Vector Arrows */}
              {currentSlide.annotations?.some(a => a.type === 'arrow') && (
                <svg className="annotations-svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <marker id="arrowhead-mint" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                      <path d="M0,1 L8,4 L0,7 Z" fill="var(--brand-green)" />
                    </marker>
                  </defs>
                  {currentSlide.annotations
                    .filter(ann => ann.type === 'arrow')
                    .map((ann, idx) => (
                      <g key={idx}>
                        <line 
                          x1={ann.x1} 
                          y1={ann.y1} 
                          x2={ann.x2} 
                          y2={ann.y2} 
                          stroke="var(--brand-green)" 
                          strokeWidth="1.2" 
                          markerEnd="url(#arrowhead-mint)" 
                          strokeDasharray="2,2"
                        />
                        {ann.label && (
                          <foreignObject 
                            x={Math.min(ann.x1, ann.x2) - 10} 
                            y={Math.min(ann.y1, ann.y2) - 8} 
                            width="40" 
                            height="10"
                            style={{ overflow: 'visible', pointerEvents: 'none' }}
                          >
                            <div className="arrow-text-label">
                              {ann.label}
                            </div>
                          </foreignObject>
                        )}
                      </g>
                    ))}
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Footer controls & Description bar */}
        <div className="slideshow-modal-footer">
          <div className="slideshow-caption-box" style={{ width: '100%' }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={e => setEditTitle(e.target.value)} 
                  placeholder="Slide Title"
                  disabled={flow.id.startsWith('rule_') && slideIndex > 0}
                  style={{ 
                    width: '100%', 
                    padding: '0.4rem', 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px', 
                    color: '#fff', 
                    fontSize: '0.95rem', 
                    fontWeight: 'bold',
                    opacity: (flow.id.startsWith('rule_') && slideIndex > 0) ? 0.5 : 1
                  }}
                />
                <textarea 
                  value={editText} 
                  onChange={e => setEditText(e.target.value)} 
                  placeholder="Slide Caption Text"
                  rows={2}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>
            ) : (
              <>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#fff' }}>{currentSlide.title}</h4>
                <p className="slideshow-caption-text" style={{ whiteSpace: 'pre-wrap' }}>{currentSlide.text || currentSlide.caption}</p>
              </>
            )}
            {renderEditControls()}
          </div>

          <div className="slideshow-nav-controls-row">
            <button 
              className={`halo-button slideshow-control-btn ${slideIndex === 0 ? 'disabled' : ''}`}
              onClick={handlePrev}
              disabled={slideIndex === 0}
            >
              <IconChevronLeft size={16} />
              Prev
            </button>

            {/* Step dot indicators */}
            <div className="slideshow-step-dots">
              {slides.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`step-dot-indicator ${slideIndex === idx ? 'active' : ''}`}
                  onClick={() => setSlideIndex(idx)}
                />
              ))}
            </div>

            <button 
              className="halo-button slideshow-control-btn next-action-btn"
              onClick={handleNext}
              disabled={isEditing}
              style={{ '--stage-accent': 'var(--brand-green)' }}
            >
              {slideIndex === slides.length - 1 ? 'Finish' : 'Next'}
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialSlideshowViewer;
