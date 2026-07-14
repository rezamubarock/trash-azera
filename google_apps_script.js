/**
 * Google Apps Script Web App for Azera OS 2FA Sync
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.google.com).
 * 2. Create a new spreadsheet. The first sheet will store the keys.
 *    Name the columns:
 *    A1: "Name", B1: "Secret", C1: "Created At"
 * 3. Go to "Extensions" > "Apps Script".
 * 4. Delete any code in Code.gs and paste this code.
 * 5. Click "Deploy" > "New deployment".
 * 6. Under "Select type", select "Web app".
 * 7. Set configuration:
 *    - Description: "Azera OS 2FA API"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (Required for cross-origin requests from static frontend)
 * 8. Click "Deploy" and copy the "Web app URL" (this is your sheets API URL).
 * 9. Paste this URL into the "⚙️ Sheets Setup" in the 2FA app.
 */

// OPTIONAL: If you created this script as a standalone script (NOT from Extensions > Apps Script inside Google Sheets),
// paste your Google Spreadsheet ID below inside the quotes. Otherwise, leave it empty.
var SPREADSHEET_ID = "";

function getSheet() {
  var ss;
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) {
    throw new Error("Spreadsheet not found. Please ensure this script is container-bound (created via Extensions > Apps Script in Google Sheets) or set the SPREADSHEET_ID variable at the top of this script.");
  }
  
  return ss.getActiveSheet();
}

// 1. GET Request: Fetches all stored 2FA credentials
function doGet(e) {
  try {
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    var data = [];
    
    if (lastRow > 1) {
      var rows = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
      // Read rows starting from row 2 (index 1) to skip headers
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] && rows[i][1]) {
          data.push({
            name: rows[i][0],
            secret: rows[i][1],
            created_at: rows[i][2] || new Date().toISOString()
          });
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. POST Request: Appends a new 2FA credential
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var sheet = getSheet();
    
    // Append rows: Name, Secret, Timestamp
    sheet.appendRow([
      params.name,
      params.secret,
      new Date().toISOString()
    ]);
    
    // Return success JSON
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
