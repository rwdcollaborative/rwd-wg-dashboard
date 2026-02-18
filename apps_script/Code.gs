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
const OPTIONS_SHEET_NAME = "Options";
const MAX_CELL_LENGTH = 5000;
const MAX_REQUEST_BYTES = 200000;
const RATE_LIMITS = {
  perMinute: 20,
  perDay: 300,
  duplicateWindowSeconds: 600
};

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
    if (raw.length > MAX_REQUEST_BYTES) {
      return jsonResponse({ ok: false, code: "VALIDATION_ERROR", message: "Submission payload is too large." });
    }
    const payload = JSON.parse(raw);

    if (payload.source !== ALLOWED_SOURCE) {
      return jsonResponse({ ok: false, code: "UNAUTHORIZED", message: "Invalid submission source." });
    }

    const tokenCheck = verifySubmitToken(payload);
    if (!tokenCheck.ok) return jsonResponse(tokenCheck);

    const record = payload.record || {};
    const recordCheck = validateRecordShape(record);
    if (!recordCheck.ok) return jsonResponse(recordCheck);

    const validation = validateRecordValues(record);
    if (!validation.ok) return jsonResponse(validation);

    const fingerprint = submissionFingerprint(record);
    const limitCheck = enforceRateLimits(fingerprint);
    if (!limitCheck.ok) return jsonResponse(limitCheck);

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
      const modifications = detectRecordModifications(record, row, header.indexByName);

      const titleCol = header.indexByName["Title"];
      if (titleCol !== undefined) title = row[titleCol];
      if (!title) {
        return jsonResponse({ ok: false, message: "Title is required." });
      }

      const emailCol = header.indexByName["Contributor Email"];
      const contributorEmail = emailCol !== undefined ? row[emailCol] : normalizeCell(record["Contributor Email"]);
      if (contributorEmail && !isValidEmail(contributorEmail)) {
        return jsonResponse({ ok: false, code: "VALIDATION_ERROR", message: "Contributor Email is not valid." });
      }

      sheet.appendRow(row);
      const response = { ok: true, message: "Row appended.", title: title };
      if (modifications.length > 0) response.modified_fields = modifications;
      return jsonResponse(response);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return jsonResponse({ ok: false, code: "INTERNAL_ERROR", message: String(err) });
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

function detectRecordModifications(record, row, indexByName) {
  const modified = [];
  INVENTORY_COLUMNS.forEach(function (name) {
    const idx = indexByName[name];
    if (idx === undefined) return;
    const rawProvided = (record[name] !== undefined && record[name] !== null) ? String(record[name]) : "";
    if (!rawProvided.trim()) return;
    const normalized = normalizeCell(rawProvided);
    const stored = String(row[idx] || "");
    if (normalized !== stored) {
      modified.push({
        field: name,
        submitted: rawProvided,
        stored: stored
      });
    }
  });
  return modified;
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
  let text = String(value).trim();
  if (text.length > MAX_CELL_LENGTH) return "";
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

function verifySubmitToken(payload) {
  const expected = normalizeCell(PropertiesService.getScriptProperties().getProperty("SUBMIT_TOKEN"));
  if (!expected) {
    return { ok: false, code: "INTERNAL_ERROR", message: "Submission token is not configured." };
  }
  const received = normalizeCell(payload && payload.submit_token);
  if (!received || received !== expected) {
    return { ok: false, code: "UNAUTHORIZED", message: "Submission token is invalid." };
  }
  return { ok: true };
}

function validateRecordShape(record) {
  if (!record || typeof record !== "object") {
    return { ok: false, code: "VALIDATION_ERROR", message: "Invalid record payload." };
  }
  const allowed = {};
  INVENTORY_COLUMNS.forEach(function (name) { allowed[name] = true; });
  const keys = Object.keys(record);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!allowed[key]) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Unexpected field: " + key };
    }
    const value = record[key];
    if (value !== null && value !== undefined && String(value).length > MAX_CELL_LENGTH) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Field too long: " + key };
    }
  }
  return { ok: true };
}

function validateRecordValues(record) {
  const title = normalizeCell(record.Title);
  if (!title) return { ok: false, code: "VALIDATION_ERROR", message: "Title is required." };

  const email = normalizeCell(record["Contributor Email"]);
  if (email && !isValidEmail(email)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Contributor Email is not valid." };
  }

  const urls = parseCsvValues(record["URL(s)"]);
  for (let i = 0; i < urls.length; i += 1) {
    if (!isValidHttpUrl(urls[i])) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Invalid URL: " + urls[i] };
    }
  }

  const options = getOptionsMap();
  const multiSelectFields = [
    "Type", "Topic", "RWD Type", "Intended Audience",
    "Artifacts Included", "Availability", "Credentials Offered"
  ];

  for (let f = 0; f < multiSelectFields.length; f += 1) {
    const field = multiSelectFields[f];
    const allowed = options[field];
    if (!allowed || allowed.size === 0) continue;
    const values = parseCsvValues(record[field]);
    for (let i = 0; i < values.length; i += 1) {
      const v = normalizeCell(values[i]).toLowerCase();
      if (v && !allowed.has(v)) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Invalid option for " + field + ": " + values[i] };
      }
    }
  }

  return { ok: true };
}

function getOptionsMap() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("options_map_v1");
    if (cached) {
      const parsed = JSON.parse(cached);
      return toSetMap(parsed);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(OPTIONS_SHEET_NAME);
    if (!sheet) return {};

    const values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) return {};

    const headers = values[0].map(function (x) { return normalizeCell(x); });
    const map = {};
    headers.forEach(function (h) { if (h) map[h] = []; });

    for (let r = 1; r < values.length; r += 1) {
      for (let c = 0; c < headers.length; c += 1) {
        const h = headers[c];
        if (!h) continue;
        const cell = normalizeCell(values[r][c]);
        if (!cell) continue;
        map[h].push(cell.toLowerCase());
      }
    }

    const compact = {};
    Object.keys(map).forEach(function (k) {
      compact[k] = uniqueValues(map[k]);
    });
    cache.put("options_map_v1", JSON.stringify(compact), 300);
    return toSetMap(compact);
  } catch (err) {
    return {};
  }
}

function toSetMap(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(function (k) {
    out[k] = new Set((obj[k] || []).map(function (v) { return String(v).toLowerCase(); }));
  });
  return out;
}

function uniqueValues(values) {
  const seen = {};
  const out = [];
  (values || []).forEach(function (v) {
    const key = String(v).toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(key);
  });
  return out;
}

function parseCsvValues(raw) {
  const text = normalizeCell(raw);
  if (!text) return [];
  const parts = text.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
  return parts.map(function (p) {
    return String(p).replace(/^\s*"?|"?\s*$/g, "").replace(/\\"/g, "\"").trim();
  }).filter(function (x) { return !!x; });
}

function isValidHttpUrl(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (!/^https?:\/\//i.test(text)) return false;
  if (/\s/.test(text)) return false;
  const hostMatch = text.match(/^https?:\/\/([^\/?#:]+)(?::\d+)?/i);
  if (!hostMatch || !hostMatch[1]) return false;
  const host = hostMatch[1].toLowerCase();
  if (host.indexOf(".") === -1) return false;
  const tld = host.split(".").pop();
  return /^[a-z]{2,63}$/.test(tld);
}

function submissionFingerprint(record) {
  const parts = [
    normalizeCell(record.Title).toLowerCase(),
    normalizeCell(record["URL(s)"]).toLowerCase(),
    normalizeCell(record.Organization).toLowerCase(),
    normalizeCell(record["Contributor Email"]).toLowerCase()
  ];
  const joined = parts.join("|");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, joined, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest);
}

function enforceRateLimits(fingerprint) {
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const now = new Date();
    const minuteKey = "rl:min:" + Utilities.formatDate(now, "UTC", "yyyyMMddHHmm");
    const dayKey = "rl:day:" + Utilities.formatDate(now, "UTC", "yyyyMMdd");
    const dupKey = "rl:dup:" + fingerprint;

    const minuteCount = parseInt(cache.get(minuteKey) || "0", 10);
    if (minuteCount >= RATE_LIMITS.perMinute) {
      return { ok: false, code: "RATE_LIMITED", message: "Too many submissions right now. Please try again in a minute." };
    }

    const dayCount = parseInt(cache.get(dayKey) || "0", 10);
    if (dayCount >= RATE_LIMITS.perDay) {
      return { ok: false, code: "RATE_LIMITED", message: "Daily submission limit reached. Please try again tomorrow." };
    }

    if (cache.get(dupKey)) {
      return { ok: false, code: "DUPLICATE_RECENT", message: "This appears to be a recent duplicate submission." };
    }

    cache.put(minuteKey, String(minuteCount + 1), 120);
    cache.put(dayKey, String(dayCount + 1), 60 * 60 * 24);
    cache.put(dupKey, "1", RATE_LIMITS.duplicateWindowSeconds);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
