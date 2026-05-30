import React, { useState } from 'react';
import { IconX, IconChevronLeft, IconChevronRight } from './Icons';
import './TutorialHub.css';

const TutorialSlideshowViewer = ({ flow, platform, onClose }) => {
  const [slideIndex, setSlideIndex] = useState(0);

  // Pick slides based on target environment
  const slides = platform === 'desktop' ? flow.desktopSlides : flow.mobileSlides;
  const currentSlide = slides[slideIndex];

  if (!currentSlide) return null;

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
            
            <h2 className="onboarding-title">{currentSlide.title}</h2>
            <p className="onboarding-text">{currentSlide.text}</p>
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
                // If public compiled asset is not immediately resolved, load fallback screenshot path
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
                  return (
                    <div 
                      key={idx}
                      className="annotation-thought-bubble animate-fade-in"
                      style={{
                        top: `${ann.top}%`,
                        left: `${ann.left}%`
                      }}
                    >
                      <div className="thought-bubble-pulse"></div>
                      <div className="thought-bubble-text">
                        {ann.text}
                      </div>
                      <div className="thought-bubble-pointer"></div>
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
          <div className="slideshow-caption-box">
            <p className="slideshow-caption-text">{currentSlide.caption}</p>
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
