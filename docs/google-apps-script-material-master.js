/**
 * Google Apps Script untuk Material Master Data
 * Deploy as Web App → Anyone can access (Published as web content)
 */

function doGet(e) {
  try {
    // GANTI dengan Spreadsheet ID Anda
    const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Bisa ganti nama sheet sesuai kebutuhan
    const sheetName = e.parameter.sheet || 'Sheet1';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: `Sheet "${sheetName}" not found` }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return ContentService
        .createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // First row as headers
    const headers = data[0];
    const result = [];
    
    // Convert rows to objects
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        obj[header] = row[j];
      }
      
      result.push(obj);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: error.toString(),
        message: 'Failed to fetch material data'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Struktur Sheet Material Master
 * 
 * Headers (Row 1):
 * | Part Number | Material | JENIS BARANG | Mesin | Spesifikasi | ... |
 * 
 * Data (Row 2+):
 * | 1180277 | SEAL OIL COOLER | MATERIAL HANDAL | MAN 250 | ... |
 * | 0118 3003 | FILTER UDARA | MATERIAL HANDAL | GENSET | ... |
 */

/**
 * Test function - run in Script Editor
 */
function testDoGet() {
  const result = doGet({parameter: {}});
  const data = JSON.parse(result.getContent());
  Logger.log('Total materials: ' + data.length);
  if (data.length > 0) {
    Logger.log('First item: ' + JSON.stringify(data[0]));
  }
}
