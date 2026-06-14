const SHEET_ID = "1UX2bUNkMuyYsLSlQ7veHH-HEpM2OILZ1ngQ15O_Y-AI";
const SHEET_NAME = "Data";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");

    if (!data.user || !data.title || !data.date) {
      return jsonOutput({ ok: false, error: "user, title, date are required" });
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    sheet.appendRow([
      Utilities.getUuid(),
      String(data.user).trim(),
      String(data.title).trim(),
      String(data.date).trim(),
      String(data.note || "").trim(),
      new Date()
    ]);

    return jsonOutput({ ok: true });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function doGet(e) {
  try {
    const user = String(e.parameter.user || "").trim();
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      return jsonOutput([]);
    }

    const headers = values.shift();
    const rows = values
      .map(row => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])))
      .filter(row => !user || row.user === user);

    return jsonOutput(rows);
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function normalizeCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value;
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
