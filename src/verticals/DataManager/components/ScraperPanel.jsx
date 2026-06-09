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
    <div className="dm-card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <div className="dm-card__header">
        <h3 className="dm-card__title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🌐</span> HTML Web Scraper
        </h3>
        <p className="dm-card__description">
          Calculate Final URLs automatically and scrape specific HTML data fields into the grid.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginTop: '1rem' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.4rem', fontWeight: 600 }}>
            Target HTML/JSON Field to Scrape
          </label>
          <input
            type="text"
            value={targetField}
            onChange={(e) => setTargetField(e.target.value)}
            placeholder="e.g. title, price, model, status"
            style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}
            disabled={disabled}
            required
          />
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.4rem', fontWeight: 600 }}>
            Output Column Name in Grid
          </label>
          <input
            type="text"
            value={outputColumn}
            onChange={(e) => setOutputColumn(e.target.value)}
            placeholder="e.g. Scraped Value"
            style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}
            disabled={disabled}
            required
          />
        </div>

        <button
          type="submit"
          className="halo-button primary"
          disabled={disabled || !targetField.trim() || !outputColumn.trim()}
          style={{ height: '38px', whiteSpace: 'nowrap' }}
        >
          {progress && progress.current < progress.total ? 'Scraping...' : 'Run Scraper on Sheet'}
        </button>
      </form>

      {progress && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: '#00ffcc' }}>Progress: {progress.current} / {progress.total} ({percentage}%)</span>
            <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>Status: {progress.status}</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${percentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00ffcc, #0099ff)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScraperPanel;
