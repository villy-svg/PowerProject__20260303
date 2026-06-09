/**
 * scraperService.js
 * Frontend service layer for proxying scraping requests through
 * the isolated 'scraper-service' Edge Function.
 */
import { supabase } from './supabaseClient';

export const scraperService = {
  /**
   * Fetches HTML from a target URL securely through the scraper-service Edge Function
   * to bypass client-side browser CORS restrictions.
   */
  async fetchHtmlViaServer(url) {
    if (!url) throw new Error('url is required');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('User is not authenticated. Cannot call scraper service.');
    }

    const { data, error } = await supabase.functions.invoke('scraper-service', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: { url },
    });

    if (error) {
      console.error('[scraperService] fetch failed:', error);
      let detailedMessage = error.message;
      if (error.context && typeof error.context.text === 'function') {
        try {
          const bodyText = await error.context.text();
          const parsed = JSON.parse(bodyText);
          if (parsed && parsed.error) {
            detailedMessage = parsed.error;
          }
        } catch (_) {}
      }
      throw new Error(detailedMessage || 'Scraper service request failed');
    }

    if (data && data.success === false) {
      throw new Error(data.error || 'Scraper operation failed');
    }

    return data?.data || '';
  }
};
