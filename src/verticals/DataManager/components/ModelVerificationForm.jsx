/**
 * ModelVerificationForm.jsx
 *
 * Dedicated interactive single-vehicle scraper tool for the Model Verification Board.
 * Replaces the spreadsheet loader and grid on this board.
 */

import React, { useState, useEffect } from 'react';
import { buildFinalUrl, parseHtmlField, fetchHtmlViaProxy } from '../utils/scraperUtils';

const ModelVerificationForm = () => {
  const [vehicleNumber, setVehicleNumber] = useState(() => {
    return localStorage.getItem('mv_vehicle_number') || 'KA03AM7356';
  });
  const [baseUrl, setBaseUrl] = useState(() => {
    return localStorage.getItem('mv_base_url') || 'https://www.carinfo.app/rc-details/';
  });
  const [finalUrl, setFinalUrl] = useState('');
  const [scrapingField, setScrapingField] = useState(() => {
    return localStorage.getItem('mv_scraping_field') || 'input_vehical_layout_vehicalmodel__1abtf';
  });
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  // Recalculate Final URL dynamically when Base URL or Vehicle Number changes
  useEffect(() => {
    const derivedUrl = buildFinalUrl(baseUrl, vehicleNumber);
    setFinalUrl(derivedUrl);
    
    // Save to local storage for testing ease
    localStorage.setItem('mv_vehicle_number', vehicleNumber);
    localStorage.setItem('mv_base_url', baseUrl);
  }, [baseUrl, vehicleNumber]);

  useEffect(() => {
    localStorage.setItem('mv_scraping_field', scrapingField);
  }, [scrapingField]);

  const handleRunScrape = async (e) => {
    e.preventDefault();
    if (!finalUrl || !scrapingField) return;

    setLoading(true);
    setOutput('Initiating server-side fetch...\nFetching ' + finalUrl + '...');
    
    try {
      const html = await fetchHtmlViaProxy(finalUrl);
      setOutput((prev) => prev + '\nFetch completed successfully! Parsing HTML...');
      
      const scrapedVal = parseHtmlField(html, scrapingField);
      setOutput(scrapedVal);
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dm-card dm-card-centered">
      <div className="dm-card__header">
        <h2 className="dm-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>🔍</span> Model Verification Board
        </h2>
        <p className="dm-card__description">
          Test and verify HTML structures by scraping single vehicle details directly through the backend server.
        </p>
      </div>

      <form onSubmit={handleRunScrape} className="dm-form-layout">
        <div className="dm-form-row">
          <div className="dm-form-col">
            <label className="dm-label">
              Vehicle Number
            </label>
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. KA03AM7356"
              className="dm-input"
              disabled={loading}
              required
            />
          </div>

          <div className="dm-form-col dm-form-col--wide">
            <label className="dm-label">
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="e.g. https://www.carinfo.app/rc-details/"
              className="dm-input"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div>
          <label className="dm-label">
            Final URL (Automatically Concatenated)
          </label>
          <input
            type="text"
            value={finalUrl}
            readOnly
            className="dm-input"
          />
        </div>

        <div>
          <label className="dm-label">
            Scraping Field Name (Class Name / Attribute / Key)
          </label>
          <input
            type="text"
            value={scrapingField}
            onChange={(e) => setScrapingField(e.target.value)}
            placeholder="e.g. input_vehical_layout_vehicalmodel__1abtf"
            className="dm-input"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label className="dm-label">
            Output Response
          </label>
          <textarea
            value={output}
            readOnly
            rows={5}
            placeholder="Scrape output will be displayed here..."
            className={`dm-textarea ${output.startsWith('Error') ? 'dm-textarea--error' : (loading ? 'dm-textarea--loading' : '')}`}
          />
        </div>

        <div className="dm-form-actions">
          <button
            type="submit"
            className="halo-button primary dm-action-btn--large"
            disabled={loading || !finalUrl || !scrapingField}
          >
            {loading ? (
              <>
                <span className="dm-spinner dm-spinner--sm" style={{ width: '14px', height: '14px', margin: 0, borderWidth: '2px' }} />
                Scraping...
              </>
            ) : (
              'Run Scrape'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ModelVerificationForm;
