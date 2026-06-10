/**
 * ModelVerificationForm.jsx
 *
 * Dedicated interactive single-vehicle scraper tool for the Model Verification Board.
 * Replaces the spreadsheet loader and grid on this board.
 */

import React, { useState, useEffect, useRef } from 'react';
import { buildFinalUrl, parseHtmlField, fetchHtmlViaProxy } from '../utils/scraperUtils';

const ModelVerificationForm = () => {
  const bookmarkletRef = useRef(null);
  const [mode, setMode] = useState('automated'); // 'automated' or 'manual'
  const [pastedHtml, setPastedHtml] = useState('');
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

  // Dynamically set bookmarklet href to bypass React security checks against javascript: URLs in JSX
  useEffect(() => {
    if (bookmarkletRef.current) {
      const targetClass = 'input_vehical_layout_vehicalModel__1ABTF';
      const jsCode = `javascript:(function(){const f='${targetClass}';let v='';let e=document.querySelector(f.startsWith('.')||f.startsWith('%23')?f:'.'+f)||document.querySelector('[class*="'+f+'"]')||document.querySelector('[id*="'+f+'"]');if(e){v=e.innerText.trim();}else{const h=document.body.innerHTML;const r=new RegExp('<[^>]*(?:class|id|name|data-[a-z-]+)=["\\\\u0027\\\\u0022][^"\\\\u0027\\\\u0022]*'+f+'[^"\\\\u0027\\\\u0022]*["\\\\u0027\\\\u0022][^>]*>([\\\\\\\\s\\\\\\\\S]*?)</','i');const m=h.match(r);if(m&&m[1]){const t=document.createElement('div');t.innerHTML=m[1];v=t.innerText.trim();}}if(v){navigator.clipboard.writeText(v).then(()=>{alert('Success! Copied to Clipboard:\\\\n"'+v+'"');}).catch(()=>{alert('Clipboard error. Extracted value:\\\\n'+v);});}else{alert('Could not find field matching "'+f+'" on this page.');}})();`;
      bookmarkletRef.current.setAttribute('href', jsCode);
    }
  });

  const handleRunScrape = async (e) => {
    e.preventDefault();
    if (!scrapingField) return;

    setLoading(true);
    
    if (mode === 'manual') {
      setOutput('Parsing pasted HTML source...');
      try {
        if (!pastedHtml.trim()) {
          throw new Error('Please paste HTML page source code before running the parser.');
        }
        const scrapedVal = parseHtmlField(pastedHtml, scrapingField);
        setOutput(scrapedVal);
      } catch (err) {
        setOutput(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!finalUrl) {
      setLoading(false);
      return;
    }

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

  const isScrapingBlocked = output.includes('CORS proxies failed to load page') || output.includes('DDoS');

  return (
    <div className="dm-card dm-card-centered">
      <div className="dm-card__header">
        <h2 className="dm-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>🔍</span> Model Verification Board
        </h2>
        <p className="dm-card__description">
          Test and verify HTML structures by scraping single vehicle details or parsing manually pasted HTML page source code.
        </p>
      </div>

      {/* Mode Selector Tab Group */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          type="button"
          className={`halo-button dm-tab-btn ${mode === 'automated' ? 'dm-tab-btn--active' : 'dm-tab-btn--inactive'}`}
          style={{ cursor: 'pointer', borderRadius: '12px' }}
          onClick={() => setMode('automated')}
          disabled={loading}
        >
          🌐 Fetch via URL
        </button>
        <button
          type="button"
          className={`halo-button dm-tab-btn ${mode === 'manual' ? 'dm-tab-btn--active' : 'dm-tab-btn--inactive'}`}
          style={{ cursor: 'pointer', borderRadius: '12px' }}
          onClick={() => setMode('manual')}
          disabled={loading}
        >
          📝 Paste HTML Manually
        </button>
      </div>

      {/* Cloudflare/DDoS Warning Banner */}
      {mode === 'automated' && isScrapingBlocked && (
        <div className="dm-alert dm-alert--error" style={{ marginBottom: '20px' }}>
          <strong>⚠️ Scraping Blocked by Cloudflare/DDoS Protection</strong>
          <p>
            The target website is blocking automated requests. You can bypass this by opening the page in your browser, copying the page source (Ctrl+U / Right Click -> View Page Source), and pasting it here.
          </p>
          <button
            type="button"
            className="halo-button dm-action-btn"
            style={{ marginTop: '12px', height: '36px', minWidth: 'unset', display: 'flex', alignItems: 'center' }}
            onClick={() => {
              setMode('manual');
              setOutput('');
            }}
          >
            Switch to Manual Paste Mode
          </button>
        </div>
      )}

      <form onSubmit={handleRunScrape} className="dm-form-layout">
        {mode === 'automated' ? (
          <>
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
          </>
        ) : (
          <div>
            <label className="dm-label">
              Pasted HTML Page Source
            </label>
            <textarea
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              rows={8}
              placeholder="Right-click target page -> View Source / Inspect, copy the HTML content and paste it here..."
              className="dm-textarea"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}
              disabled={loading}
              required
            />
          </div>
        )}

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
            placeholder={mode === 'manual' ? "Parse output will be displayed here..." : "Scrape output will be displayed here..."}
            className={`dm-textarea ${output.startsWith('Error') ? 'dm-textarea--error' : (loading ? 'dm-textarea--loading' : '')}`}
          />
        </div>

        <div className="dm-form-actions">
          <button
            type="submit"
            className="halo-button primary dm-action-btn--large"
            disabled={loading || (mode === 'automated' ? (!finalUrl || !scrapingField) : (!pastedHtml || !scrapingField))}
          >
            {loading ? (
              <>
                <span className="dm-spinner dm-spinner--sm" style={{ width: '14px', height: '14px', margin: 0, borderWidth: '2px' }} />
                {mode === 'manual' ? 'Parsing...' : 'Scraping...'}
              </>
            ) : (
              mode === 'manual' ? 'Run Parser' : 'Run Scrape'
            )}
          </button>
        </div>
      </form>

      {/* Chrome Bookmarklet Tool */}
      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
        <h3 className="dm-card__title" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '8px' }}>
          <span>🔖</span> Chrome Bookmarklet Integration
        </h3>
        <p className="dm-card__description" style={{ fontSize: '13px', marginBottom: '16px' }}>
          Bypass server blocks completely! Drag the button below to your Bookmarks Bar, then click it when viewing any vehicle details page on Chrome to copy the value.
        </p>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
            <div>
              <span className="dm-label" style={{ marginBottom: '4px', opacity: 0.5 }}>1. DRAG TO BOOKMARKS BAR</span>
              <a
                ref={bookmarkletRef}
                className="halo-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'grab',
                  height: '38px',
                  borderRadius: '10px',
                  padding: '0 16px',
                  fontWeight: '800',
                  color: 'var(--brand-green)'
                }}
                onClick={(e) => {
                  e.preventDefault();
                  alert('Installation: Drag this button up to your browser Bookmarks Bar (Ctrl+Shift+B if hidden) to install.');
                }}
              >
                📋 Copy Vehicle Model
              </a>
            </div>

            <div style={{ flex: '1 1 280px', fontSize: '12px', color: 'var(--text-color)', opacity: 0.8 }}>
              <span className="dm-label" style={{ marginBottom: '4px', opacity: 0.5 }}>2. HOW TO USE</span>
              <ol style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.6' }}>
                <li>Make sure your bookmarks bar is visible (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>).</li>
                <li>Drag the green button above onto your bookmarks bar.</li>
                <li>Visit the page on <strong>carinfo.app</strong> (e.g. your vehicle URL).</li>
                <li>Click the bookmarklet in your bookmarks bar—the value is copied instantly!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelVerificationForm;
