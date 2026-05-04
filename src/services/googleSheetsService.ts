/**
 * GOOGLE APPS SCRIPT CODE (Paste this in Extensions > Apps Script in your Google Sheet)
 *
 * function doPost(e) {
 *   var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *   var data = JSON.parse(e.postData.contents);
 *
 *   sheet.appendRow([
 *     new Date(),
 *     data.sucursal,
 *     data.legajoNombre,
 *     JSON.stringify(data.scores),
 *     data.observaciones,
 *     data.evidencias.length + " imagenes"
 *   ]);
 *
 *   return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 */

import { AuditData } from '../types';

const WEB_APP_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL?.trim() || '';

export const hasGoogleSheetsConfig = Boolean(WEB_APP_URL);

export const testConnection = async () => {
  if (!WEB_APP_URL) return false;

  try {
    const response = await fetch(WEB_APP_URL, { method: 'GET' });
    return response.ok;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
};

export const saveToSheets = async (data: AuditData) => {
  if (!WEB_APP_URL) {
    console.warn('No Google Apps Script URL provided. Data not saved to Sheets.');
    return { success: true, localOnly: true };
  }

  try {
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Google Sheets request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving to sheets:', error);
    throw error;
  }
};
