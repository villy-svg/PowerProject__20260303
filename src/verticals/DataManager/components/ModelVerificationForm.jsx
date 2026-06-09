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
    <div className="dm-card" style={{ maxWidth: '720px', margin: '0 auto 2rem auto', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <div className="dm-card__header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '1rem' }}>
        <h2 className="dm-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>🔍</span> Model Verification Board
        </h2>
        <p className="dm-card__description">
          Test and verify HTML structures by scraping single vehicle details directly through the backend server.
        </p>
      </div>

      <form onSubmit={handleRunScrape} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, opacity: 0.85, marginBottom: '0.4rem' }}>
              Vehicle Number
            </label>
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. KA03AM7356"
              style={{ width: '100%', padding: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '0.9rem' }}
              disabled={loading}
              required
            />
          </div>

          <div style={{ flex: '2 1 350px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, opacity: 0.85, marginBottom: '0.4rem' }}>
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="e.g. https://www.carinfo.app/rc-details/"
              style={{ width: '100%', padding: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '0.9rem' }}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, opacity: 0.85, marginBottom: '0.4rem' }}>
            Final URL (Automatically Concatenated)
          </label>
          <input
            type="text"
            value={finalUrl}
            readOnly
            style={{ width: '100%', padding: '0.7rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', color: '#888', fontSize: '0.9rem', cursor: 'not-allowed' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, opacity: 0.85, marginBottom: '0.4rem' }}>
            Scraping Field Name (Class Name / Attribute / Key)
          </label>
          <input
            type="text"
            value={scrapingField}
            onChange={(e) => setScrapingField(e.target.value)}
            placeholder="e.g. input_vehical_layout_vehicalmodel__1abtf"
            style={{ width: '100%', padding: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '0.9rem' }}
            disabled={loading}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, opacity: 0.85, marginBottom: '0.4rem' }}>
            Output Response
          </label>
          <textarea
            value={output}
            readOnly
            rows={5}
            placeholder="Scrape output will be displayed here..."
            style={{ 
              width: '100%', 
              padding: '0.7rem', 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              borderRadius: '4px', 
              color: output.startsWith('Error') ? '#ff5252' : (loading ? '#00ffcc' : '#e0e0e0'), 
              fontSize: '0.9rem', 
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="halo-button primary"
            disabled={loading || !finalUrl || !scrapingField}
            style={{ padding: '0.6rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}
          >
            {loading ? (
              <>
                <span className="dm-spinner dm-spinner--sm" style={{ width: '14px', height: '14px', margin: 0 }} />
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
