/**
 * Shared database for community needs reports, using a Google Sheet.
 *
 * Setup (about 5 minutes):
 * 1. Create a new Google Sheet. Extensions > Apps Script.
 * 2. Paste this file in, replacing everything. Save.
 * 3. Deploy > New deployment > type "Web app".
 *    Execute as: Me. Who has access: Anyone.
 * 4. Copy the web app URL and paste it into js/config.js as submitEndpoint.
 *
 * Privacy: names and phone numbers are stored in the sheet but are never
 * returned by doGet, so they do not appear on the public map.
 */
const SHEET_NAME = "reports";
const FIELDS = ["id", "date", "lat", "lng", "ward", "wardCode", "constituency", "category",
  "title", "details", "urgency", "affected", "source", "name", "phone", "consent"];
const PUBLIC = ["id", "date", "lat", "lng", "ward", "wardCode", "constituency", "category",
  "title", "details", "urgency", "affected", "source"];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(FIELDS.concat(["approved"]));
  }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rec = JSON.parse(e.postData.contents);
    // basic validation: must sit roughly inside Kiambu County
    const lat = Number(rec.lat), lng = Number(rec.lng);
    if (!(lat < -0.7 && lat > -1.35 && lng > 36.3 && lng < 37.4)) throw new Error("Location outside Kiambu");
    const row = FIELDS.map(function (f) { return String(rec[f] == null ? "" : rec[f]).slice(0, 600); });
    row.push("yes"); // set to "no" in the sheet to hide a report from the map
    sheet_().appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const values = sheet_().getDataRange().getValues();
  const head = values.shift();
  const out = values
    .filter(function (r) { return r[head.indexOf("approved")] !== "no"; })
    .map(function (r) {
      const o = {};
      PUBLIC.forEach(function (f) { o[f] = r[head.indexOf(f)]; });
      o.lat = Number(o.lat); o.lng = Number(o.lng); o.urgency = Number(o.urgency);
      o.affected = o.affected === "" ? null : Number(o.affected);
      return o;
    });
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
