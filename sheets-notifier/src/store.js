const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

let state = { sheets: [], recipients: { phones: [], emails: [] } };

function normalizeState() {
  if (!Array.isArray(state.sheets)) state.sheets = [];
  if (!state.recipients || typeof state.recipients !== 'object') {
    state.recipients = { phones: [], emails: [] };
  }
  if (!Array.isArray(state.recipients.phones)) state.recipients.phones = [];
  if (!Array.isArray(state.recipients.emails)) state.recipients.emails = [];
}

function load() {
  let existed = false;
  try {
    if (fs.existsSync(STORE_PATH)) {
      existed = true;
      state = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read store, starting empty:', err.message);
    state = { sheets: [], recipients: { phones: [], emails: [] } };
  }
  normalizeState();

  // Seed recipients from env defaults the first time the store is created.
  if (!existed) {
    state.recipients.phones = [...new Set(config.defaultRecipients.phones)];
    state.recipients.emails = [...new Set(config.defaultRecipients.emails)];
    persist();
  }
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

function getSheets() {
  return state.sheets;
}

function findSheet(id) {
  return state.sheets.find((s) => s.id === id);
}

function addSheet(sheet) {
  if (findSheet(sheet.id)) return false;
  state.sheets.push(sheet);
  persist();
  return true;
}

function removeSheet(id) {
  const before = state.sheets.length;
  state.sheets = state.sheets.filter((s) => s.id !== id);
  if (state.sheets.length !== before) {
    persist();
    return true;
  }
  return false;
}

function updateSheet(id, patch) {
  const sheet = findSheet(id);
  if (!sheet) return null;
  Object.assign(sheet, patch);
  persist();
  return sheet;
}

function getRecipients() {
  return state.recipients;
}

function setRecipients({ phones, emails }) {
  if (Array.isArray(phones)) {
    state.recipients.phones = [...new Set(phones.map((p) => p.trim()).filter(Boolean))];
  }
  if (Array.isArray(emails)) {
    state.recipients.emails = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  }
  persist();
  return state.recipients;
}

load();

module.exports = {
  getSheets,
  findSheet,
  addSheet,
  removeSheet,
  updateSheet,
  getRecipients,
  setRecipients,
};
