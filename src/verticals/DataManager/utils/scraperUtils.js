/**
 * scraperUtils.js
 * Client-side scraping utilities for Model Verification Board.
 * Uses a public CORS proxy to retrieve page HTML, then parses it for targeted values.
 */

/**
 * Builds the final URL by directly concatenating Base URL and Vehicle Number (Excel-style '&' concatenation).
 * Ensures the scheme (http/https) is present.
 */
export const buildFinalUrl = (baseUrl = '', vehicleNumber = '') => {
  let cleanBase = baseUrl.trim();
  if (!cleanBase) return '';

  // Add protocol prefix if missing
  if (!/^https?:\/\//i.test(cleanBase)) {
    cleanBase = 'https://' + cleanBase;
  }

  const cleanVehicle = vehicleNumber.trim();
  return cleanBase + cleanVehicle;
};

/**
 * Parses raw HTML string to find the value of a target field.
 * Uses fallback parsing techniques (class names, meta tags, json-ld/scripts, table rows, regex).
 */
export const parseHtmlField = (html = '', fieldName = '') => {
  if (!html || !fieldName) return '';
  const term = fieldName.trim().toLowerCase();

  // Helper to strip HTML tags and clean up string
  const cleanVal = (str) => {
    if (!str) return '';
    return str
      .replace(/<\/?[^>]+(>|$)/g, '') // strip tags
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // 0. Try finding by class name, id, name or custom attribute (case-insensitive attribute search)
  // Matches e.g. <span class="input_vehical_layout_vehicalmodel__1abtf">Tata Tigor</span>
  const attrRegex = new RegExp(`<[^>]*(?:class|id|name|data-[a-z-]+)=["'][^"']*${fieldName.trim()}[^"']*["'][^>]*>([\\s\\S]*?)</`, 'i');
  const attrMatch = html.match(attrRegex);
  if (attrMatch && attrMatch[1]) {
    const val = cleanVal(attrMatch[1]);
    if (val) return val;
  }

  // 1. Try finding in Meta tags
  // Matches <meta name="field" content="value">, <meta property="og:field" content="value">
  const metaRegexes = [
    new RegExp(`<meta\\s+[^>]*?(?:name|property)=["'](?:og:)?${term}["'][^>]*?content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:name|property)=["'](?:og:)?${term}["']`, 'i')
  ];

  for (const regex of metaRegexes) {
    const match = html.match(regex);
    if (match && match[1]) {
      return cleanVal(match[1]);
    }
  }

  // 2. Try JSON-LD or script contents
  // Matches e.g. "field": "value", "field" : 1234
  const jsonRegex = new RegExp(`["']${term}["']\\s*:\\s*(["'])(.*?)\\1`, 'i');
  const jsonMatch = html.match(jsonRegex);
  if (jsonMatch && jsonMatch[2]) {
    return cleanVal(jsonMatch[2]);
  }

  // Matches numeric/boolean JSON values
  const jsonNumRegex = new RegExp(`["']${term}["']\\s*:\\s*([^"'{}\\(\\)\\[\\],\\s]+)`, 'i');
  const jsonNumMatch = html.match(jsonNumRegex);
  if (jsonNumMatch && jsonNumMatch[1]) {
    return cleanVal(jsonNumMatch[1]);
  }

  // 3. Try HTML table cell patterns
  // Matches e.g. <td>Field</td><td>Value</td>
  const tableRegex = new RegExp(`<t[dh][^>]*>\\s*${term}\\s*</t[dh]>\\s*<td[^>]*>(.*?)</td>`, 'i');
  const tableMatch = html.match(tableRegex);
  if (tableMatch && tableMatch[1]) {
    return cleanVal(tableMatch[1]);
  }

  // Matches e.g. <div>Field</div><div>Value</div>
  const divLabelRegex = new RegExp(`<div[^>]*>\\s*${term}\\s*</div>\\s*<div[^>]*>(.*?)</div>`, 'i');
  const divLabelMatch = html.match(divLabelRegex);
  if (divLabelMatch && divLabelMatch[1]) {
    return cleanVal(divLabelMatch[1]);
  }

  // 4. Try general Regex pattern matching (fallback for plain text / basic HTML)
  // Matches e.g. Field: Value
  const fallbackRegex = new RegExp(`${term}\\s*[:=-]\\s*([^<\\n\\r]+)`, 'i');
  const fallbackMatch = html.match(fallbackRegex);
  if (fallbackMatch && fallbackMatch[1]) {
    return cleanVal(fallbackMatch[1]);
  }

  // Special fallback for "title" field -> look for <title> tag
  if (term === 'title') {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return cleanVal(titleMatch[1]);
    }
  }

  return 'Not Found';
};

/**
 * Fetches HTML from a URL using multiple fallback public CORS proxies.
 */
export const fetchHtmlViaProxy = async (url) => {
  // Proxy 1: corsproxy.io (returns raw HTML directly, fast)
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (res.ok) {
      const html = await res.text();
      if (html && html.trim().length > 0) return html;
    }
  } catch (err) {
    console.warn('[Scraper] corsproxy.io failed, trying fallback...', err);
  }

  // Proxy 2: api.allorigins.win (returns wrapped JSON)
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.contents) return data.contents;
    }
  } catch (err) {
    console.error('[Scraper] allorigins fallback failed.', err);
  }

  throw new Error('All CORS proxies failed to retrieve page source. Check your internet connection.');
};
