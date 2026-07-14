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

function getSheet(sheetName) {
  var ss;
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) {
    throw new Error("Spreadsheet not found. Please ensure this script is container-bound (created via Extensions > Apps Script in Google Sheets) or set the SPREADSHEET_ID variable at the top of this script.");
  }
  
  if (sheetName && sheetName.trim() !== "") {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (sheetName.toLowerCase() === "links") {
        sheet.appendRow(["ID", "Name", "URL", "Created At"]);
      } else {
        sheet.appendRow(["ID", "Name", "Secret", "Created At"]);
      }
    }
    return sheet;
  }
  
  return ss.getActiveSheet();
}

// 1. GET Request: Fetches all stored 2FA credentials
function doGet(e) {
  try {
    var sheetName = (e && e.parameter && e.parameter.sheet) || "";
    var sheet = getSheet(sheetName);
    var lastRow = sheet.getLastRow();
    var data = [];
    
    if (lastRow > 1) {
      var lastCol = sheet.getLastColumn();
      var rows = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      
      // Read rows starting from row 2 (index 1) to skip headers
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var id = "";
        var name = "";
        var secret = "";
        var createdAt = "";
        
        if (lastCol >= 4) {
          id = row[0];
          name = row[1];
          secret = row[2];
          createdAt = row[3] || new Date().toISOString();
        } else {
          // Legacy 3-column format
          name = row[0];
          secret = row[1];
          createdAt = row[2] || new Date().toISOString();
          id = createdAt;
        }
        
        if (name && secret) {
          data.push({
            id: id,
            name: name,
            secret: secret,
            created_at: createdAt
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
    var sheetName = params.sheet || "";
    var sheet = getSheet(sheetName);
    var action = params.action || "add";
    
    var lastCol = sheet.getLastColumn();
    
    if (action === "delete") {
      var rows = sheet.getDataRange().getValues();
      var deleted = false;
      for (var i = 1; i < rows.length; i++) {
        var rowId = lastCol >= 4 ? rows[i][0] : rows[i][2];
        if (String(rowId) === String(params.id)) {
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
        var rowId = lastCol >= 4 ? rows[i][0] : rows[i][2];
        if (String(rowId) === String(params.id)) {
          if (lastCol >= 4) {
            sheet.getRange(i + 1, 2).setValue(params.name);
            sheet.getRange(i + 1, 3).setValue(params.secret);
          } else {
            sheet.getRange(i + 1, 1).setValue(params.name);
            sheet.getRange(i + 1, 2).setValue(params.secret);
          }
          updated = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: updated }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else {
      var id = params.id || Utilities.getUuid();
      var name = params.name || "";
      var secret = params.secret || "";
      var createdAt = params.created_at || new Date().toISOString();
      
      if (lastCol >= 4) {
        sheet.appendRow([id, name, secret, createdAt]);
      } else {
        sheet.appendRow([name, secret, createdAt]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, id: id }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
