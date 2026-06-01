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
      throw new Error(error.message || 'Google Sheets service request failed');
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
   * @returns {Promise<Array[]>} Matrix of spreadsheet rows
   */
  async readSheet(spreadsheetId, range = 'Sheet1!A:Z') {
    if (!spreadsheetId) throw new Error('spreadsheetId is required');
    const result = await this._invoke({
      action: 'readSheet',
      spreadsheetId,
      range,
    });
    return result.data || [];
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
  }
};
