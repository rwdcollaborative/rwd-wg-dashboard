const SHEET_NAME = "Inventory";
const HEADER_ROW = 2;
const INVENTORY_COLUMNS = [
  "Title", "Type", "Other Type", "Topic", "Other Topic", "RWD Type", "Other RWD Type",
  "URL(s)", "Organization", "Spacer 1", "Contributor Name", "Contributor Email",
  "Contributor Organization", "Spacer 2", "Description", "Intended Audience",
  "Other Intended Audience", "Artifacts Included", "Other Artifacts Included",
  "Availability", "Other Availability", "Credentials Offered", "Other Credentials Offered",
  "Comments", "Column 1"
];
const META_COLUMNS = {
  createdAt: "Meta Created At",
  updatedAt: "Meta Updated At",
  source: "Meta Source"
};

const ALLOWED_SOURCE = "rwd-dashboard-submit-form";
const MAX_CELL_LENGTH = 50000;

function doGet() {
  return jsonResponse({
    ok: true,
    message: "RWD Inventory submission endpoint is running",
    sheet: SHEET_NAME,
    timestamp: new Date().toISOString(),
    meta_columns: META_COLUMNS
  });
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const payload = JSON.parse(raw);

    if (payload.source !== ALLOWED_SOURCE) {
      return jsonResponse({ ok: false, message: "Invalid submission source." });
    }

    const record = payload.record || {};
    const submittedAt = normalizeIsoTimestamp(payload.submitted_at);

    const lock = LockService.getDocumentLock();
    lock.waitLock(30000);

    let title = normalizeCell(record.Title);
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      if (!sheet) {
        return jsonResponse({ ok: false, message: "Inventory sheet not found." });
      }

      const header = getHeaderContext(sheet);
      const row = buildRow(header, record, submittedAt, "form");

      const titleCol = header.indexByName["Title"];
      if (titleCol !== undefined) title = row[titleCol];
      if (!title) {
        return jsonResponse({ ok: false, message: "Title is required." });
      }

      const emailCol = header.indexByName["Contributor Email"];
      const contributorEmail = emailCol !== undefined ? row[emailCol] : normalizeCell(record["Contributor Email"]);
      if (contributorEmail && !isValidEmail(contributorEmail)) {
        return jsonResponse({ ok: false, message: "Contributor Email is not valid." });
      }

      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true, message: "Row appended.", title: title });
  } catch (err) {
    return jsonResponse({ ok: false, message: String(err) });
  }
}

// Tracks manual edits in metadata columns. This runs for direct edits in the sheet.
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== SHEET_NAME) return;
  if (e.range.getRow() <= HEADER_ROW) return;

  const header = getHeaderContext(sheet);
  const editedColumn = e.range.getColumn() - 1;
  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  const endRow = startRow + numRows - 1;

  const createdIdx = header.indexByName[META_COLUMNS.createdAt];
  const updatedIdx = header.indexByName[META_COLUMNS.updatedAt];
  const sourceIdx = header.indexByName[META_COLUMNS.source];

  // No metadata columns configured.
  if (createdIdx === undefined && updatedIdx === undefined && sourceIdx === undefined) return;

  // Ignore edits to metadata columns to avoid edit loops.
  if (editedColumn === createdIdx || editedColumn === updatedIdx || editedColumn === sourceIdx) return;

  const nowIso = new Date().toISOString();

  for (let row = startRow; row <= endRow; row++) {
    if (updatedIdx !== undefined) {
      sheet.getRange(row, updatedIdx + 1).setValue(nowIso);
    }
    if (sourceIdx !== undefined) {
      sheet.getRange(row, sourceIdx + 1).setValue("manual");
    }
  }
}

function getHeaderContext(sheet) {
  const colCount = sheet.getLastColumn();
  const headers = sheet.getRange(HEADER_ROW, 1, 1, colCount).getValues()[0];
  const indexByName = {};

  headers.forEach(function (name, i) {
    const trimmed = normalizeCell(name);
    if (trimmed) indexByName[trimmed] = i;
  });

  return { headers: headers, indexByName: indexByName, colCount: colCount };
}

function buildRow(header, record, timestampIso, sourceValue) {
  const row = Array(header.colCount).fill("");

  INVENTORY_COLUMNS.forEach(function (name) {
    setByColumnName(row, header.indexByName, name, record[name]);
  });

  setByColumnName(row, header.indexByName, META_COLUMNS.createdAt, timestampIso);
  setByColumnName(row, header.indexByName, META_COLUMNS.updatedAt, timestampIso);
  setByColumnName(row, header.indexByName, META_COLUMNS.source, sourceValue);

  return row;
}

function setByColumnName(row, indexByName, columnName, value) {
  const idx = indexByName[columnName];
  if (idx === undefined) return;
  row[idx] = normalizeCell(value);
}

function normalizeIsoTimestamp(value) {
  const fallback = new Date().toISOString();
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (text.length <= MAX_CELL_LENGTH) return text;
  return text.slice(0, MAX_CELL_LENGTH);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
