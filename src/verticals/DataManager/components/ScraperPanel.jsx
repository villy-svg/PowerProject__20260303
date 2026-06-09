/**
 * ScraperPanel.jsx
 *
 * Config panel and progress tracking UI for the web scraper.
 * Only visible on the Model Verification Board.
 */

import React, { useState } from 'react';

const ScraperPanel = ({ onRunScraper, progress, disabled }) => {
  const [targetField, setTargetField] = useState('title');
  const [outputColumn, setOutputColumn] = useState('Scraped Value');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetField.trim() || !outputColumn.trim()) return;
    onRunScraper(targetField.trim(), outputColumn.trim());
  };

  const percentage = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="dm-card" style={{ marginBottom: '24px' }}>
      <div className="dm-card__header">
        <h3 className="dm-card__title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🌐</span> HTML Web Scraper
        </h3>
        <p className="dm-card__description">
          Calculate Final URLs automatically and scrape specific HTML data fields into the grid.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="dm-form-row">
        <div className="dm-form-col">
          <label className="dm-label">
            Target HTML/JSON Field to Scrape
          </label>
          <input
            type="text"
            value={targetField}
            onChange={(e) => setTargetField(e.target.value)}
            placeholder="e.g. title, price, model, status"
            className="dm-input"
            disabled={disabled}
            required
          />
        </div>

        <div className="dm-form-col">
          <label className="dm-label">
            Output Column Name in Grid
          </label>
          <input
            type="text"
            value={outputColumn}
            onChange={(e) => setOutputColumn(e.target.value)}
            placeholder="e.g. Scraped Value"
            className="dm-input"
            disabled={disabled}
            required
          />
        </div>

        <button
          type="submit"
          className="halo-button primary dm-action-btn"
          disabled={disabled || !targetField.trim() || !outputColumn.trim()}
          style={{ height: '42px', whiteSpace: 'nowrap' }}
        >
          {progress && progress.current < progress.total ? 'Scraping...' : 'Run Scraper on Sheet'}
        </button>
      </form>

      {progress && (
        <div className="dm-progress-box">
          <div className="dm-progress-header">
            <span className="dm-progress-stats">Progress: {progress.current} / {progress.total} ({percentage}%)</span>
            <span className="dm-progress-status">Status: {progress.status}</span>
          </div>
          <div className="dm-progress-track">
            <div
              className="dm-progress-bar"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScraperPanel;
