import React, { useState, useMemo } from 'react';
import { parseRuleSlides } from './TutorialHub';
import './CustomerVehicleRule.css';

/**
 * CustomerVehicleRule
 * Renders a company policy rule as an interactive multi-slide tutorial.
 */
const CustomerVehicleRule = ({ rule }) => {
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = useMemo(() => parseRuleSlides(rule.title, rule.content || ''), [rule.title, rule.content]);
  const currentSlide = slides[slideIndex];

  const handlePrev = (e) => {
    e.stopPropagation();
    if (slideIndex > 0) setSlideIndex(slideIndex - 1);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (slideIndex < slides.length - 1) setSlideIndex(slideIndex + 1);
  };

  const handleReset = (e) => {
    e.stopPropagation();
    setSlideIndex(0);
  };

  if (!currentSlide) return null;

  return (
    <div className="rule-card tutorial-mode">
      <div className="rule-card-header">
        <h4 className="rule-card-title">
          {currentSlide.isIntro ? rule.title : currentSlide.title}
        </h4>
      </div>

      <div className="rule-card-badges">
        {rule.sub_category?.name && (
          <span className="rule-badge">{rule.sub_category.name}</span>
        )}
        <span className="rule-badge slide-counter">
          Page {slideIndex + 1} of {slides.length}
        </span>
      </div>

      <div className="rule-tutorial-body">
        <p className={`rule-slide-text ${currentSlide.isIntro ? 'intro-slide-text' : 'bullet-slide-text'}`}>
          {currentSlide.text}
        </p>
      </div>

      <div className="rule-tutorial-progress">
        <div 
          className="rule-tutorial-progress-bar" 
          style={{ width: `${((slideIndex + 1) / slides.length) * 100}%` }}
        />
      </div>

      <div className="rule-tutorial-controls">
        <button
          className="halo-button prev-btn"
          disabled={slideIndex === 0}
          onClick={handlePrev}
        >
          ◀ Prev
        </button>
        {slideIndex > 0 && (
          <button className="rule-restart-btn" onClick={handleReset} title="Restart Tutorial">
            Restart
          </button>
        )}
        <button
          className="halo-button next-btn"
          disabled={slideIndex === slides.length - 1}
          onClick={handleNext}
        >
          {slideIndex === slides.length - 1 ? 'Finish 🎉' : 'Next ▶'}
        </button>
      </div>

      {rule.drive_url && (
        <a
          href={rule.drive_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rule-drive-link"
        >
          📄 View Full Document ↗
        </a>
      )}
    </div>
  );
};

export default CustomerVehicleRule;
