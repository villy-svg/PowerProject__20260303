/**
 * scraperUtils.js
 * Client-side scraping utilities for Model Verification Board.
 * Uses a public CORS proxy to retrieve page HTML, then parses it for targeted values.
 */

/**
 * Builds the final URL by concatenating Base URL and Vehicle Number with an '&' character.
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
  if (!cleanVehicle) return cleanBase;

  // Perform string "&" join as requested
  if (cleanBase.endsWith('&')) {
    return cleanBase + cleanVehicle;
  }
  
  // If base URL has query params but does not end with '&', append '&'
  if (cleanBase.includes('?')) {
    return `${cleanBase}&${cleanVehicle}`;
  }

  // Fallback to joining with '&'
  return `${cleanBase}&${cleanVehicle}`;
};

/**
 * Parses raw HTML string to find the value of a target field.
 * Uses fallback parsing techniques (meta tags, json-ld/scripts, table rows, regex).
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
  const jsonNumRegex = new RegExp(`["']${term}["']\\s*:\\s*([^"'{}\\[\\],\\s]+)`, 'i');
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
 * Fetches HTML from a URL using a public CORS proxy.
 */
export const fetchHtmlViaProxy = async (url) => {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL. HTTP status: ${response.status}`);
  }
  const data = await response.json();
  return data.contents || '';
};
