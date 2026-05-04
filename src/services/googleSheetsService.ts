
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
 *     data.evidencias.length + " imágenes"
 *   ]);
 *   
 *   return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 */

import { AuditData } from '../types';

// NOTE: This usually requires a deployed Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxcOFgcJbUc-sw-SOPLSO2Vzow3_xtMDO_oWSISns_5lNLYncYk5Htuo75egTvoFxsz/exec'; // User should put their deployed GAS URL here

export const testConnection = async () => {
  if (!WEB_APP_URL) return false;
  try {
    const response = await fetch(WEB_APP_URL);
    const text = await response.text();
    return text === "OK";
  } catch (error) {
    console.error("Connection test failed:", error);
    return false;
  }
};

export const saveToSheets = async (data: AuditData) => {
  if (!WEB_APP_URL) {
    console.warn("No Google Apps Script URL provided. Data not saved to Sheets.");
    // We simulate success for the demo if URL is missing
    return { success: true, localOnly: true };
  }

  try {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    console.error("Error saving to sheets:", error);
    throw error;
  }
};
