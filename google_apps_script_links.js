/**
 * Google Apps Script Web App for Azera OS Link List Sync
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.google.com).
 * 2. Create a new spreadsheet.
 *    Name the columns:
 *    A1: "ID", B1: "Name", C1: "URL", D1: "Created At"
 * 3. Go to "Extensions" > "Apps Script".
 * 4. Delete any code in Code.gs and paste this code.
 * 5. Click "Deploy" > "New deployment".
 * 6. Under "Select type", select "Web app".
 * 7. Set configuration:
 *    - Description: "Azera OS Link List API"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (Required for cross-origin requests from static frontend)
 * 8. Click "Deploy" and copy the "Web app URL" (this is your sheets API URL).
 * 9. Paste this URL into the "⚙️ Settings" in the Link List tool.
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
    throw new Error("Spreadsheet not found. Please ensure this script is container-bound or set SPREADSHEET_ID.");
  }
  
  var sheet = ss.getActiveSheet();
  
  // Auto initialize headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Name", "URL", "Created At"]);
  }
  
  return sheet;
}

// 1. GET Request: Fetches all stored links
function doGet(e) {
  try {
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    var data = [];
    
    if (lastRow > 1) {
      var rows = sheet.getRange(1, 1, lastRow, 4).getValues();
      // Read rows starting from row 2 (index 1) to skip headers
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] && rows[i][1]) {
          data.push({
            id: rows[i][0],
            name: rows[i][1],
            url: rows[i][2],
            created_at: rows[i][3] || new Date().toISOString()
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

// 2. POST Request: Add, Update, or Delete links
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var sheet = getSheet();
    var action = params.action || "add";
    
    if (action === "delete") {
      var rows = sheet.getDataRange().getValues();
      var deleted = false;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(params.id)) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: deleted }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === "update") {
      var rows = sheet.getDataRange().getValues();
      var updated = false;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(params.id)) {
          sheet.getRange(i + 1, 2).setValue(params.name);
          sheet.getRange(i + 1, 3).setValue(params.url);
          updated = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: updated }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else {
      // Default: ADD
      var id = params.id || Utilities.getUuid();
      var name = params.name || "";
      var url = params.url || "";
      var createdAt = params.created_at || new Date().toISOString();
      
      sheet.appendRow([id, name, url, createdAt]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, id: id }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
