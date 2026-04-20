/**
 * Google Apps Script untuk Data Pengadaan
 * Deploy as Web App → Anyone can access
 */

function doGet(e) {
  try {
    // GANTI dengan Spreadsheet ID Anda
    const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('data KR');
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Sheet "data KR" not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data
    const data = sheet.getDataRange().getValues();
    
    // Convert to array of objects with column index
    const result = [];
    
    // Skip header row (index 0)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      
      // Map each column to Kolom_N
      for (let j = 0; j < row.length; j++) {
        obj[`Kolom_${j}`] = row[j];
      }
      
      result.push(obj);
    }
    
    // Return JSON with "data KR" key
    const response = {
      'data KR': result,
      'timestamp': new Date().toISOString(),
      'total_rows': result.length
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: error.toString(),
        message: 'Failed to fetch data'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function - run in Script Editor
 */
function testDoGet() {
  const result = doGet();
  Logger.log(result.getContent());
}
