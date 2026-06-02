/**
 * googleSheetsService.js
 * Frontend service layer for interacting with Google Sheets.
 * Securely proxies all calls through the Supabase 'sheets-service' Edge Function
 * to prevent exposing any service account keys or Google API tokens in the browser.
 */
import { supabase } from './supabaseClient';

export const googleSheetsService = {
  /**
   * Helper to invoke the sheets-service Edge Function.
   */
  async _invoke(payload) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('User is not authenticated. Cannot call Google Sheets service.');
    }

    const { data, error } = await supabase.functions.invoke('sheets-service', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: payload,
    });

    if (error) {
      console.error('[googleSheetsService] call failed:', error);
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
      throw new Error(detailedMessage || 'Google Sheets service request failed');
    }

    if (data && data.success === false) {
      throw new Error(data.error || 'Google Sheets operation failed');
    }

    return data;
  },

  /**
   * Reads cell values from a specific Google Sheet range.
   * @param {string} spreadsheetId - The target Google Spreadsheet ID
   * @param {string} [range] - Range (e.g. 'Sheet1!A1:D10', defaults to 'Sheet1!A:Z')
   * @param {string} [valueRenderOption] - 'FORMATTED_VALUE', 'UNFORMATTED_VALUE', or 'FORMULA'
   * @returns {Promise<Array[]>} Matrix of spreadsheet rows
   */
  async readSheet(spreadsheetId, range = 'Sheet1!A:Z', valueRenderOption = 'FORMATTED_VALUE') {
    if (!spreadsheetId) throw new Error('spreadsheetId is required');
    const result = await this._invoke({
      action: 'readSheet',
      spreadsheetId,
      range,
      valueRenderOption,
    });
    return result.data || [];
  },

  /**
   * Fetches metadata for a spreadsheet, including available sheets/tabs.
   * @param {string} spreadsheetId - The target Google Spreadsheet ID
   * @returns {Promise<object>} Spreadsheet metadata containing list of sheets
   */
  async getSpreadsheet(spreadsheetId) {
    if (!spreadsheetId) throw new Error('spreadsheetId is required');
    const result = await this._invoke({
      action: 'getSpreadsheet',
      spreadsheetId,
      range: 'Sheet1!A1', // minimal request to fetch metadata
    });
    return result.data || {};
  },

  /**
   * Appends rows of data to a specific Google Sheet.
   * @param {string} spreadsheetId - The target Google Spreadsheet ID
   * @param {Array[]} values - Array of row arrays (e.g. [['John', 'Doe', 'j@eg.com']])
   * @param {string} [range] - Target table range descriptor (defaults to 'Sheet1!A:A')
   * @param {string} [valueInputOption] - 'USER_ENTERED' (converts strings to numbers/dates) or 'RAW'
   */
  async appendRow(spreadsheetId, values, range = 'Sheet1!A:A', valueInputOption = 'USER_ENTERED') {
    if (!spreadsheetId) throw new Error('spreadsheetId is required');
    if (!values || !Array.isArray(values)) throw new Error('values must be an array of arrays');
    
    const result = await this._invoke({
      action: 'appendRow',
      spreadsheetId,
      range,
      values,
      valueInputOption,
    });
    return result.updates;
  },

  /**
   * Updates cell values within a specific range in a Google Sheet.
   * @param {string} spreadsheetId - The target Google Spreadsheet ID
   * @param {string} range - Exact target range to overwrite (e.g. 'Sheet1!A2:C2')
   * @param {Array[]} values - Overwriting rows
   * @param {string} [valueInputOption] - 'USER_ENTERED' or 'RAW'
   */
  async updateSheet(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
    if (!spreadsheetId) throw new Error('spreadsheetId is required');
    if (!range) throw new Error('range is required');
    if (!values || !Array.isArray(values)) throw new Error('values must be an array of arrays');

    const result = await this._invoke({
      action: 'updateSheet',
      spreadsheetId,
      range,
      values,
      valueInputOption,
    });
    return result.updatedCells;
  },

  /**
   * Performs a batch update on multiple ranges in a Google Sheet in a single request.
   * @param {string} spreadsheetId - The target Google Spreadsheet ID
   * @param {Array<{ range: string, values: Array[] }>} data - Array of ranges and values
   * @param {string} [valueInputOption] - 'USER_ENTERED' or 'RAW'
   */
  async batchUpdateSheet(spreadsheetId, data, valueInputOption = 'USER_ENTERED') {
    if (!spreadsheetId) throw new Error('spreadsheetId is required');
    if (!data || !Array.isArray(data)) throw new Error('data must be an array of ranges and values');

    const result = await this._invoke({
      action: 'batchUpdateSheet',
      spreadsheetId,
      data,
      valueInputOption,
    });
    return result.updatedCells;
  }
};
